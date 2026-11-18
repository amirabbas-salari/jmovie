"""ساخت دیتابیس تست برای بک‌اند libSQL."""

from django.db.backends.sqlite3.creation import (
    DatabaseCreation as SQLiteDatabaseCreation,
)


class DatabaseCreation(SQLiteDatabaseCreation):
    def _get_test_db_name(self):
        # بک‌اند sqlite جنگو برای تست از دیتابیس اشتراکی file:...?mode=memory
        # استفاده می‌کند که مخصوص URI sqlite3 است؛ libsql آن را اسم فایل
        # تفسیر می‌کند. اینجا همان رفتار ساده‌ی in-memory یا اسم صریح تست
        # را نگه می‌داریم.
        return self.connection.settings_dict["TEST"]["NAME"] or ":memory:"
