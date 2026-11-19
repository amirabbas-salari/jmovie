"""
چاپ دامپ SQL کامل فایل sqlite فعلی روی خروجی استاندارد.

برای انتقال تمیز دیتابیس به Turso استفاده می‌شود: خروجی دقیقاً همان
اسکیمای واقعی جنگو (با PRIMARY KEY و همه‌ی قیدها) به‌همراه همه‌ی داده‌هاست
و مستقیم می‌تواند به دیتابیس تازه‌ی Turso داده شود:

    python manage.py dump_sqlite_sql > dump.sql
    turso db shell <new-db> < dump.sql

توجه: عمداً از اتصال جنگو (DATABASES) استفاده نمی‌شود و فایل مستقیم خوانده
می‌شود؛ پس حتی وقتی TURSO_DATABASE_URL ست شده و اتصال پیش‌فرض روی Turso
است، باز هم فایل sqlite خوانده می‌شود. فایل فقط‌خواندنی باز می‌شود.
"""

import os
import sqlite3
import sys

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "دامپ SQL کامل فایل sqlite (اسکیمای دقیق جنگو + همه‌ی داده‌ها) برای انتقال به Turso"

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            default=None,
            help="مسیر فایل sqlite؛ پیش‌فرض: SQLITE_PATH یا /data/db.sqlite3 یا db.sqlite3 کنار پروژه",
        )

    def _default_path(self):
        env_path = os.environ.get("SQLITE_PATH")
        if env_path:
            return env_path
        if os.path.exists("/data/db.sqlite3"):
            return "/data/db.sqlite3"
        return str(settings.BASE_DIR / "db.sqlite3")

    def handle(self, *args, **options):
        path = options["path"] or self._default_path()
        if not os.path.exists(path):
            raise CommandError(f"فایل دیتابیس پیدا نشد: {path}")
        try:
            # متن دیتابیس فارسی است؛ خروجی حتماً UTF-8 باشد تا هنگام ذخیره
            # در فایل روی سیستم کاربر خراب نشود.
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
        connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        try:
            schema_statements = []
            data_statements = []
            for statement in connection.iterdump():
                normalized = statement.strip().upper()
                if normalized in ("BEGIN TRANSACTION;", "COMMIT;"):
                    continue
                if normalized.startswith("CREATE"):
                    schema_statements.append(statement)
                else:
                    data_statements.append(statement)
        finally:
            connection.close()

        for statement in schema_statements:
            self.stdout.write(statement)
        self.stdout.write("BEGIN;")
        # چک کلیدهای خارجی تا پایان تراکنش عقب می‌افتد؛ روی Turso که FK
        # همیشه روشن است، بدون این ایمپورت کامل رد نمی‌شود.
        self.stdout.write("PRAGMA defer_foreign_keys = ON;")
        for statement in data_statements:
            self.stdout.write(statement)
        self.stdout.write("COMMIT;")
