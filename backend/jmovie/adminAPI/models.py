from django.conf import settings
from django.db import models


class AdminAuditLog(models.Model):
    """ثبت رویدادهای پنل مدیریت (چه کسی، چه چیزی را، کی تغییر داد).

    برای پاسخ‌گویی و امنیت نگه داشته می‌شود؛ فقط سوپرادمین (یا دارنده‌ی
    مجوز مشاهده‌ی لاگ) می‌تواند آن را ببیند.
    """

    ACTION_CREATE = "create"
    ACTION_UPDATE = "update"
    ACTION_DELETE = "delete"
    ACTION_CHOICES = (
        (ACTION_CREATE, "ایجاد"),
        (ACTION_UPDATE, "ویرایش"),
        (ACTION_DELETE, "حذف"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admin_audit_logs",
    )
    username = models.CharField(max_length=150, blank=True)
    action = models.CharField(max_length=10, choices=ACTION_CHOICES, db_index=True)
    model_label = models.CharField(max_length=100, db_index=True)  # e.g. movies.movie
    object_id = models.CharField(max_length=64, blank=True)
    object_repr = models.CharField(max_length=255, blank=True)
    changes = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "لاگ فعالیت ادمین"
        verbose_name_plural = "لاگ‌های فعالیت ادمین"
        permissions = [
            ("view_admin_dashboard", "می‌تواند داشبورد مدیریت را ببیند"),
        ]

    def __str__(self):
        return f"{self.username} {self.action} {self.model_label}#{self.object_id}"
