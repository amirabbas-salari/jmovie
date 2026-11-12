from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SupportMessage(TimeStampedModel):
    """پیام‌های صفحه‌ی «حمایت از ما / پشتیبانی»: پیام عمومی، گزارش لینک
    خراب و درخواست فیلم/سریال. همه‌ی پیام‌ها همیشه در دیتابیس ذخیره
    می‌شوند و علاوه بر آن (در صورت تنظیم) برای ادمین به تلگرام و/یا
    ایمیل هم فرستاده می‌شوند — سرویس اعلان در core/notify.py است."""

    CATEGORY_GENERAL = "general"
    CATEGORY_REPORT = "report"
    CATEGORY_REQUEST = "request"
    CATEGORY_CHOICES = (
        (CATEGORY_GENERAL, "پیام به پشتیبانی"),
        (CATEGORY_REPORT, "گزارش لینک خراب"),
        (CATEGORY_REQUEST, "درخواست فیلم/سریال"),
    )

    category = models.CharField(
        max_length=20, choices=CATEGORY_CHOICES, default=CATEGORY_GENERAL, db_index=True
    )
    name = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    subject = models.CharField(max_length=200, blank=True)
    message = models.TextField()
    # جزئیات اختصاصی هر فرم (نام اثر، کیفیت، سال، نوع محتوا و…)
    meta = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "پیام پشتیبانی"
        verbose_name_plural = "پیام‌های پشتیبانی"

    def __str__(self):
        return f"[{self.get_category_display()}] {self.name or self.email or self.pk}"
