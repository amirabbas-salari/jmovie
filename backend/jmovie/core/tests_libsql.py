"""تست‌های بک‌اند libSQL ‏(Turso) — بدون نیاز به سرور واقعی Turso.

این تست‌ها لایه‌ی آداپتور را روی دیتابیس in-memory/file لوکال libsql اجرا
می‌کنند؛ مسیر ریموت دقیقاً از همین کد رد می‌شود و فقط آدرس اتصال عوض می‌شود.
"""

import datetime
import decimal
import os
import tempfile
import uuid

from django.db import IntegrityError
from django.test import SimpleTestCase

from core.db.backends.libsql.base import DatabaseWrapper


def _make_wrapper(name=":memory:"):
    return DatabaseWrapper(
        {
            "ENGINE": "core.db.backends.libsql",
            "NAME": name,
            "OPTIONS": {},
            "TEST": {},
            "AUTOCOMMIT": True,
            "ATOMIC_REQUESTS": False,
            "CONN_MAX_AGE": 0,
            "CONN_HEALTH_CHECKS": False,
            "TIME_ZONE": None,
            "USER": "",
            "PASSWORD": "",
            "HOST": "",
            "PORT": "",
        },
        alias="libsql_test",
    )


class LibsqlBackendTests(SimpleTestCase):
    def setUp(self):
        self.wrapper = _make_wrapper()
        self.wrapper.ensure_connection()
        with self.wrapper.cursor() as cursor:
            cursor.execute(
                "CREATE TABLE sample ("
                "id INTEGER PRIMARY KEY, name TEXT UNIQUE, created TEXT, ref TEXT)"
            )

    def tearDown(self):
        raw = self.wrapper.connection
        if raw is not None:
            raw._raw.close()

    def test_qmark_params_and_value_adaptation(self):
        ref = uuid.uuid4()
        with self.wrapper.cursor() as cursor:
            cursor.execute(
                "INSERT INTO sample (name, created, ref) VALUES (%s, %s, %s)",
                ("فیلم", datetime.datetime(2024, 1, 2, 3, 4, 5), ref),
            )
            row = cursor.execute(
                "SELECT name, created, ref FROM sample WHERE name = %s",
                ("فیلم",),
            ).fetchone()
        self.assertEqual(row, ("فیلم", "2024-01-02 03:04:05", str(ref)))

    def test_named_params_and_decimal(self):
        with self.wrapper.cursor() as cursor:
            cursor.execute(
                "INSERT INTO sample (name, created) VALUES (%(name)s, %(created)s)",
                {"name": "x", "created": datetime.date(2024, 5, 6)},
            )
            cursor.execute("CREATE TABLE amounts (value decimal)")
            cursor.execute(
                "INSERT INTO amounts (value) VALUES (%s)", (decimal.Decimal("1.5"),)
            )
            self.assertEqual(
                cursor.execute("SELECT created FROM sample").fetchone()[0],
                "2024-05-06",
            )
            self.assertEqual(
                float(cursor.execute("SELECT value FROM amounts").fetchone()[0]),
                1.5,
            )

    def test_cursor_iteration(self):
        with self.wrapper.cursor() as cursor:
            cursor.executemany(
                "INSERT INTO sample (name) VALUES (%s)",
                [("a",), ("b",), ("c",)],
            )
            names = [
                row[0]
                for row in cursor.execute("SELECT name FROM sample ORDER BY name")
            ]
        self.assertEqual(names, ["a", "b", "c"])

    def test_unique_constraint_raises_django_integrity_error(self):
        with self.wrapper.cursor() as cursor:
            cursor.execute("INSERT INTO sample (name) VALUES (%s)", ("dup",))
            with self.assertRaises(IntegrityError):
                cursor.execute("INSERT INTO sample (name) VALUES (%s)", ("dup",))

    def test_explicit_transaction_commit_and_rollback(self):
        # همان مسیری که transaction.atomic روی بک‌اند sqlite/libsql می‌رود:
        # BEGIN صریح در حالت اتوکامیت + commit/rollback روی کانکشن.
        with self.wrapper.cursor() as cursor:
            cursor.execute("INSERT INTO sample (name) VALUES ('base')")

        self.wrapper.set_autocommit(
            False, force_begin_transaction_with_broken_autocommit=True
        )
        with self.wrapper.cursor() as cursor:
            cursor.execute("INSERT INTO sample (name) VALUES ('rolled-back')")
        self.wrapper.rollback()
        self.wrapper.set_autocommit(True)

        self.wrapper.set_autocommit(
            False, force_begin_transaction_with_broken_autocommit=True
        )
        with self.wrapper.cursor() as cursor:
            cursor.execute("INSERT INTO sample (name) VALUES ('committed')")
        self.wrapper.commit()
        self.wrapper.set_autocommit(True)

        with self.wrapper.cursor() as cursor:
            names = [
                row[0]
                for row in cursor.execute("SELECT name FROM sample ORDER BY name")
            ]
        self.assertEqual(names, ["base", "committed"])

    def test_manual_autocommit_off_begins_implicit_transaction(self):
        self.wrapper.set_autocommit(False)
        with self.wrapper.cursor() as cursor:
            cursor.execute("INSERT INTO sample (name) VALUES ('manual')")
            self.assertTrue(self.wrapper.connection.in_transaction)
        self.wrapper.rollback()
        self.wrapper.set_autocommit(True)
        with self.wrapper.cursor() as cursor:
            count = cursor.execute("SELECT COUNT(*) FROM sample").fetchone()[0]
        self.assertEqual(count, 0)

    def test_file_database_persists_between_connections(self):
        fd, path = tempfile.mkstemp(suffix=".sqlite3")
        os.close(fd)
        try:
            first = _make_wrapper(path)
            first.ensure_connection()
            with first.cursor() as cursor:
                cursor.execute("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)")
                cursor.execute("INSERT INTO t (v) VALUES ('saved')")
            first.close()

            second = _make_wrapper(path)
            second.ensure_connection()
            with second.cursor() as cursor:
                row = cursor.execute("SELECT v FROM t").fetchone()
            second.close()
            self.assertEqual(row, ("saved",))
        finally:
            os.remove(path)
