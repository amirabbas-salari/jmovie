from django.contrib import admin

from .models import SupportMessage


@admin.register(SupportMessage)
class SupportMessageAdmin(admin.ModelAdmin):
    """خواندن پیام‌های صفحه‌ی حمایت/پشتیبانی از ادمین پیش‌فرض جنگو
    (/django-admin/) — علاوه بر اعلان تلگرام/ایمیل."""

    list_display = ("id", "category", "name", "email", "subject", "is_read", "created_at")
    list_filter = ("category", "is_read", "created_at")
    search_fields = ("name", "email", "subject", "message")
    readonly_fields = ("category", "name", "email", "subject", "message", "meta",
                       "ip_address", "created_at", "updated_at")
    actions = ("mark_as_read", "mark_as_unread")

    @admin.action(description="علامت‌گذاری به‌عنوان خوانده‌شده")
    def mark_as_read(self, request, queryset):
        queryset.update(is_read=True)

    @admin.action(description="علامت‌گذاری به‌عنوان خوانده‌نشده")
    def mark_as_unread(self, request, queryset):
        queryset.update(is_read=False)
