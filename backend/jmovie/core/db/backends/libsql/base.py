"""
بک‌اند دیتابیس libSQL ‏(Turso) برای جنگو.

چرا بک‌اند سفارشی؟ جنگو بک‌اند رسمی Turso ندارد و پکیج‌های موجود
(مثل django-libsql نسخه‌ی آلفای ۰٫۱٫۳) کپی قدیمی بک‌اند sqlite جنگو هستند
و با جنگو ۶ سازگار نیستند. این بک‌اند روی کلاینت رسمی ``libsql`` سوار می‌شود
و بقیه‌ی قطعات (فیچرها، اسکیماادیتور، اینتراسپکشن و…) را از بک‌اند sqlite خودِ
جنگو به ارث می‌برد؛ چون libSQL از نظر SQL همان SQLite است.

نکاتی که این فایل دور می‌زند (تفاوت‌های کلاینت رسمی libsql با sqlite3 استاندارد):
- کانکشن libsql نه ``create_function`` دارد، نه ``isolation_level`` قابل‌نوشتن
  و کرسرش ``factory`` نمی‌پذیرد و iterable نیست؛ پس یک لایه‌ی آداپتور
  (``LibsqlConnection``/``LibsqlCursorWrapper``) همان سطح API مورد انتظار جنگو
  را شبیه‌سازی می‌کند.
- تراکنش: کانکشن با ``isolation_level=None`` (اتوکامیت واقعی درایور) ساخته
  می‌شود. بلوک‌های ``atomic`` جنگو مثل بک‌اند sqlite با ``BEGIN`` صریح کار
  می‌کنند و حالت دستی (autocommit=False) هم با BEGIN ضمنی قبل از اولین
  دستور نوشتنی شبیه‌سازی می‌شود.
- توابع SQL سفارشی sqlite (مثل ``django_date_extract``) روی سرور ریموت قابل
  ثبت نیستند؛ کوئری‌های ORM پروژه از آن‌ها استفاده نمی‌کنند.
- پارامترهای datetime/date/UUID/Decimal که درایور libsql قبول نمی‌کند، قبل از
  ارسال به معادل رشته‌ای sqlite تبدیل می‌شوند (همان کاری که آداپتورهای
  sqlite3 می‌کردند).
"""

import datetime
import decimal
import re
import uuid
from collections.abc import Mapping

import libsql

from django.core.exceptions import ImproperlyConfigured
from django.db.backends.sqlite3.base import (
    FORMAT_QMARK_REGEX,
    DatabaseWrapper as SQLiteDatabaseWrapper,
)
from django.utils.asyncio import async_unsafe

from .creation import DatabaseCreation
from .features import DatabaseFeatures


# ---------------------------------------------------------------------------
# خطاهای DB-API: کلاینت libsql فقط یک نوع خطا (libsql.Error) دارد؛ جنگو اما
# از روی نوع خطا تصمیم می‌گیرد (مثلاً IntegrityError برای نقض یکتایی). پس
# برای هر نوع استاندارد یک زیرکلاس می‌سازیم و هنگام اجرا، خطای خام را بر اساس
# متن پیام به نزدیک‌ترین نوع نگاشت می‌کنیم.
# ---------------------------------------------------------------------------
class InterfaceError(libsql.Error):
    pass


class InternalError(libsql.Error):
    pass


class OperationalError(libsql.Error):
    pass


class ProgrammingError(libsql.Error):
    pass


class IntegrityError(libsql.Error):
    pass


class DataError(libsql.Error):
    pass


class NotSupportedError(libsql.Error):
    pass


# درایور libsql خطاهای SQL را ValueError پرتاب می‌کند (نه libsql.Error)؛
# هر دو باید گرفته و بر اساس متن پیام SQLite نگاشت شوند.
_DRIVER_ERRORS = (libsql.Error, ValueError)


def _map_error(exc):
    """تبدیل خطای خام libsql به نزدیک‌ترین خطای استاندارد DB-API."""
    message = str(exc).lower()
    if "constraint" in message:
        cls = IntegrityError
    elif any(
        hint in message
        for hint in (
            "unsupported parameter",
            "expected a list or tuple",
        )
    ):
        cls = ProgrammingError
    elif any(
        hint in message
        for hint in (
            "no such",
            "syntax error",
            "already exists",
            "interrupted",
            "cannot start a transaction",
            "no transaction is active",
        )
    ):
        cls = OperationalError
    else:
        cls = libsql.Error
    return cls(*exc.args)


class Database:
    """جایگزین ماژول dbapi2 که جنگو روی ``DatabaseWrapper.Database`` انتظار دارد."""

    Error = libsql.Error
    Warning = type("Warning", (Exception,), {})
    InterfaceError = InterfaceError
    DatabaseError = libsql.Error
    InternalError = InternalError
    OperationalError = OperationalError
    ProgrammingError = ProgrammingError
    IntegrityError = IntegrityError
    DataError = DataError
    NotSupportedError = NotSupportedError

    PARSE_DECLTYPES = 0
    PARSE_COLNAMES = 0
    Binary = memoryview
    apilevel = "2.0"
    paramstyle = "qmark"
    threadsafety = 1
    sqlite_version_info = tuple(getattr(libsql, "sqlite_version_info", (3, 42, 0)))
    sqlite_version = ".".join(map(str, sqlite_version_info))

    @staticmethod
    def connect(*args, **kwargs):
        return LibsqlConnection(libsql.connect(*args, **kwargs))


def _adapt_value(value):
    """مقادیری که درایور libsql قبول نمی‌کند به معادل sqlite تبدیل می‌شوند."""
    if isinstance(value, datetime.datetime):
        return value.isoformat(" ")
    if isinstance(value, (datetime.date, datetime.time)):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return str(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (bytearray, memoryview)):
        return bytes(value)
    return value


def _adapt_params(params):
    if isinstance(params, Mapping):
        return {key: _adapt_value(value) for key, value in params.items()}
    return tuple(_adapt_value(value) for value in params)


_DML_RE = re.compile(r"^\s*(INSERT|UPDATE|DELETE|REPLACE)\b", re.IGNORECASE)
_NAMED_PARAM_RE = re.compile(r"%%|%\((\w+)\)s")


class LibsqlCursorWrapper:
    """
    همان کاری را برای کرسر libsql می‌کند که SQLiteCursorWrapper جنگو برای
    sqlite3 می‌کند: تبدیل سبک پارامتر جنگو (‏%s و pyformat) به qmark/named،
    به‌علاوه‌ی iterable کردن کرسر و نگاشت خطاها.
    """

    def __init__(self, cursor, connection):
        self.cursor = cursor
        self.connection = connection

    # -- اجرا -------------------------------------------------------------
    def execute(self, query, params=None):
        if params is None:
            adapted_query, adapted_params = query, None
        else:
            adapted_query, adapted_params = self._prepare(query, params)
        self.connection._maybe_begin(adapted_query)
        try:
            if adapted_params is None:
                self.cursor.execute(adapted_query)
            else:
                self.cursor.execute(adapted_query, adapted_params)
        except _DRIVER_ERRORS as exc:
            raise _map_error(exc) from exc
        return self

    def executemany(self, query, param_list):
        param_list = list(param_list)
        if not param_list:
            return self
        adapted_query, first_params = self._prepare(query, param_list[0])
        adapted_params = [first_params]
        for params in param_list[1:]:
            _, adapted = self._prepare(query, params)
            adapted_params.append(adapted)
        self.connection._maybe_begin(adapted_query)
        try:
            self.cursor.executemany(adapted_query, adapted_params)
        except _DRIVER_ERRORS as exc:
            raise _map_error(exc) from exc
        return self

    def executescript(self, script):
        try:
            self.cursor.executescript(script)
        except _DRIVER_ERRORS as exc:
            raise _map_error(exc) from exc
        return self

    def _prepare(self, query, params):
        """تبدیل سبک پارامتر جنگو به qmark؛ درایور libsql فقط positional می‌فهمد."""
        if isinstance(params, Mapping):
            return self._convert_named_query(query, params)
        return self.convert_query(query), _adapt_params(params)

    def _convert_named_query(self, query, params):
        # سبک pyformat جنگو (%(name)s) به qmark با حفظ ترتیب ظاهرشدن در کوئری.
        values = []

        def replace(match):
            if match.group(0) == "%%":
                return "%"
            values.append(_adapt_value(params[match.group(1)]))
            return "?"

        converted = _NAMED_PARAM_RE.sub(replace, query)
        return converted, tuple(values)

    def convert_query(self, query, *, param_names=None):
        if param_names is None:
            # Convert from "format" style to "qmark" style.
            return FORMAT_QMARK_REGEX.sub("?", query).replace("%%", "%")
        # Convert from "pyformat" style to "named" style.
        return query % {name: f":{name}" for name in param_names}

    # -- خواندن نتایج -------------------------------------------------------
    def fetchone(self):
        return self.cursor.fetchone()

    def fetchmany(self, size=None):
        if size is None:
            return self.cursor.fetchmany()
        return self.cursor.fetchmany(size)

    def fetchall(self):
        return self.cursor.fetchall()

    def __iter__(self):
        return self

    def __next__(self):
        row = self.fetchone()
        if row is None:
            raise StopIteration
        return row

    # -- متفرقه ------------------------------------------------------------
    @property
    def description(self):
        return self.cursor.description

    @property
    def rowcount(self):
        return self.cursor.rowcount

    @property
    def lastrowid(self):
        return self.cursor.lastrowid

    @property
    def arraysize(self):
        return self.cursor.arraysize

    @arraysize.setter
    def arraysize(self, value):
        self.cursor.arraysize = value

    def close(self):
        self.cursor.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        self.close()


class LibsqlConnection:
    """
    آداپتور روی کانکشن خام libsql با همان سطح API که بک‌اند sqlite جنگو از
    کانکشن sqlite3 انتظار دارد (cursor با factory، ‏isolation_level و…).
    """

    def __init__(self, raw_connection):
        self._raw = raw_connection
        # درایور همیشه در حالت autocommit واقعی است (isolation_level=None)؛
        # این پرچم فقط «حالت درخواستی جنگو» را نگه می‌دارد تا در حالت دستی،
        # قبل از اولین دستور نوشتنی BEGIN ضمنی زده شود.
        self._autocommit = True

    # -- حالت تراکنش --------------------------------------------------------
    @property
    def isolation_level(self):
        return None if self._autocommit else ""

    @isolation_level.setter
    def isolation_level(self, value):
        self._autocommit = value is None

    # جنگو ۶ به بعد ممکن است به‌جای isolation_level از autocommit استاندارد
    # sqlite3 استفاده کند؛ هر دو روی یک وضعیت واحد نگاشت می‌شوند.
    @property
    def autocommit(self):
        return self._autocommit

    @autocommit.setter
    def autocommit(self, value):
        self._autocommit = bool(value)

    @property
    def in_transaction(self):
        return self._raw.in_transaction

    def _maybe_begin(self, query):
        """شبیه‌سازی BEGIN ضمنی sqlite3 در حالت دستی (autocommit=False)."""
        if self._autocommit or self._raw.in_transaction:
            return
        if query and _DML_RE.match(query):
            try:
                self._raw.execute("BEGIN")
            except _DRIVER_ERRORS as exc:
                raise _map_error(exc) from exc

    # -- کرسر و اجرا ---------------------------------------------------------
    def cursor(self, factory=None):
        return LibsqlCursorWrapper(self._raw.cursor(), self)

    def execute(self, query, params=None):
        return self.cursor().execute(query, params)

    def executemany(self, query, param_list):
        return self.cursor().executemany(query, param_list)

    def executescript(self, script):
        return self.cursor().executescript(script)

    # -- تراکنش و بستن -------------------------------------------------------
    def commit(self):
        try:
            self._raw.commit()
        except _DRIVER_ERRORS as exc:
            raise _map_error(exc) from exc

    def rollback(self):
        try:
            self._raw.rollback()
        except _DRIVER_ERRORS as exc:
            raise _map_error(exc) from exc

    def close(self):
        self._raw.close()

    def sync(self):
        """همگام‌سازی replica لوکال (فقط وقتی sync_url ست شده باشد)."""
        return self._raw.sync()

    def create_function(self, *args, **kwargs):
        # روی سرور ریموت Turso تابع پایتونی قابل ثبت نیست.
        raise NotSupportedError(
            "libSQL remote connections cannot register Python functions."
        )

    def getlimit(self, category):
        # جنگو ۶ سقف تعداد پارامتر هر کوئری را از خود کانکشن می‌خواند
        # (SQLITE_LIMIT_VARIABLE_NUMBER)؛ libsql از SQLite مدرن می‌آید که
        # سقف پیش‌فرضش ۳۲۷۶۶ است.
        return 32766


class DatabaseWrapper(SQLiteDatabaseWrapper):
    vendor = "sqlite"
    display_name = "SQLite (libSQL/Turso)"

    Database = Database
    creation_class = DatabaseCreation
    features_class = DatabaseFeatures
    # بقیه (client/introspection/operations/schema) از بک‌اند sqlite جنگو
    # به ارث می‌رسند؛ libSQL از نظر SQL همان SQLite است.

    def get_connection_params(self):
        settings_dict = self.settings_dict
        if not settings_dict["NAME"]:
            raise ImproperlyConfigured(
                "settings.DATABASES is improperly configured. "
                "Please supply the NAME value."
            )
        options = dict(settings_dict.get("OPTIONS") or {})

        transaction_mode = options.pop("transaction_mode", None)
        if (
            transaction_mode is not None
            and transaction_mode.upper() not in self.transaction_modes
        ):
            allowed_transaction_modes = ", ".join(
                [f"{mode!r}" for mode in sorted(self.transaction_modes)]
            )
            raise ImproperlyConfigured(
                f"settings.DATABASES[{self.alias!r}]['OPTIONS']['transaction_mode'] "
                f"is improperly configured to '{transaction_mode}'. Use one of "
                f"{allowed_transaction_modes}, or None."
            )
        self.transaction_mode = (
            transaction_mode.upper() if transaction_mode else None
        )

        init_command = options.pop("init_command", "")
        self.init_commands = init_command.split(";")

        kwargs = {
            "database": str(settings_dict["NAME"]),
            # اتوکامیت واقعی در سطح درایور؛ مدیریت تراکنش با BEGIN صریح جنگو
            # و شبیه‌سازی لایه‌ی آداپتور انجام می‌شود.
            "isolation_level": None,
            "auth_token": options.pop("auth_token", "") or "",
            "timeout": float(options.pop("timeout", 30.0)),
            # مثل بک‌اند sqlite جنگو: اشتراک کانکشن بین تردها در لایه‌ی بالاتر
            # (خود جنگو) کنترل می‌شود، نه درایور.
            "_check_same_thread": False,
        }
        sync_url = options.pop("sync_url", None)
        if sync_url:
            kwargs["sync_url"] = sync_url
        sync_interval = options.pop("sync_interval", None)
        if sync_interval is not None:
            kwargs["sync_interval"] = float(sync_interval)
        # گزینه‌های باقی‌مانده (مثل encryption_key یا offline) مستقیم به
        # libsql.connect داده می‌شوند.
        kwargs.update(options)
        return kwargs

    @async_unsafe
    def get_new_connection(self, conn_params):
        raw = libsql.connect(**conn_params)
        connection = LibsqlConnection(raw)
        if conn_params.get("sync_url"):
            # replica لوکال: قبل از اولین استفاده یک بار با سرور همگام شو.
            raw.sync()
        try:
            raw.execute("PRAGMA foreign_keys = ON")
        except _DRIVER_ERRORS:
            # روی سرور ریموت ممکن است این پراگما پشتیبانی نشود؛ کلید خارجی در
            # خودِ Turso هم اعمال می‌شود، پس نبودنش نباید اتصال را خراب کند.
            pass
        for init_command in self.init_commands:
            if init_command := init_command.strip():
                raw.execute(init_command)
        return connection

    def create_cursor(self, name=None):
        return self.connection.cursor()
