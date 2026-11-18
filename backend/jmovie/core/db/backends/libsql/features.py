"""فیچرهای بک‌اند libSQL؛ تقریباً همه‌چیز از بک‌اند sqlite جنگو به ارث می‌رسد."""

import operator

import libsql

from django.db.backends.sqlite3.features import (
    DatabaseFeatures as SQLiteDatabaseFeatures,
)
from django.utils.functional import cached_property

_SQLITE_VERSION_INFO = tuple(getattr(libsql, "sqlite_version_info", (3, 42, 0)))


class DatabaseFeatures(SQLiteDatabaseFeatures):
    # نسخه‌ی SQLite سمت libSQL ملاک است، نه sqlite لوکال پایتون.
    can_alter_table_drop_column = _SQLITE_VERSION_INFO >= (3, 35, 5)
    # جنگو ۶ این را از getlimit() کانکشن می‌خواند؛ مقدار ثابتِ SQLite مدرن
    # (۳۲۷۶۶) را می‌دهیم تا به API اختصاصی sqlite3 وابسته نباشیم.
    max_query_params = 32766

    @cached_property
    def can_return_columns_from_insert(self):
        return _SQLITE_VERSION_INFO >= (3, 35)

    can_return_rows_from_bulk_insert = property(
        operator.attrgetter("can_return_columns_from_insert")
    )
