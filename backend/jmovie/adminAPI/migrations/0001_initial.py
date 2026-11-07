# Generated for the rebuilt admin panel (RBAC + audit log)

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AdminAuditLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("username", models.CharField(blank=True, max_length=150)),
                ("action", models.CharField(choices=[("create", "ایجاد"), ("update", "ویرایش"), ("delete", "حذف")], db_index=True, max_length=10)),
                ("model_label", models.CharField(db_index=True, max_length=100)),
                ("object_id", models.CharField(blank=True, max_length=64)),
                ("object_repr", models.CharField(blank=True, max_length=255)),
                ("changes", models.JSONField(blank=True, default=dict)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="admin_audit_logs", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "لاگ فعالیت ادمین",
                "verbose_name_plural": "لاگ‌های فعالیت ادمین",
                "ordering": ["-created_at"],
                "permissions": [("view_admin_dashboard", "می‌تواند داشبورد مدیریت را ببیند")],
            },
        ),
    ]
