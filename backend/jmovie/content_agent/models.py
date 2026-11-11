from django.conf import settings
from django.db import models

from core.models import TimeStampedModel


class AgentSettings(models.Model):
    """تنظیمات ایجنت — همیشه فقط یک ردیف (pk=1) دارد."""

    SOURCE_CHOICES = [
        ("trending", "ترند هفته"),
        ("new", "جدیدترین‌ها"),
        ("popular", "محبوب‌ترین‌ها"),
        ("top_rated", "برترین‌های تاریخ"),
        ("custom", "منبع سفارشی (کشف از سایت)"),
    ]

    sources = models.JSONField(default=list, help_text="فهرست منابع فعال")
    max_items_per_run = models.PositiveIntegerField(default=20)
    min_rating = models.FloatField(default=6.0, help_text="حداقل امتیاز TMDB")
    min_votes = models.PositiveIntegerField(default=50, help_text="حداقل تعداد رأی")
    translate_with_ai = models.BooleanField(
        default=True,
        help_text="ترجمه‌ی عنوان/خلاصه با AI وقتی ترجمه‌ی فارسی در TMDB نیست",
    )
    # منبع کشف سفارشی: آدرس sitemap.xml یا RSS یک سایت. ایجنت فقط
    # «عنوان» آثار را از آن می‌خواند تا بفهمد چه چیزی را ندارد؛ اطلاعات
    # کامل از TMDB می‌آید. لینک دانلود از منبع خوانده نمی‌شود.
    discovery_source_url = models.URLField(
        blank=True,
        default="",
        help_text="آدرس sitemap یا RSS سایت منبع برای کشف آثار (فقط عنوان خوانده می‌شود)",
    )
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(
            pk=1,
            defaults={
                "sources": ["trending", "new", "popular", "top_rated"],
            },
        )
        return obj

    def __str__(self):
        return "تنظیمات ایجنت محتوا"


class AgentRun(TimeStampedModel):
    """گزارش هر اجرای ایجنت (دستی از پنل یا زمان‌بندی‌شده)."""

    STATUS_RUNNING = "running"
    STATUS_SUCCESS = "success"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_RUNNING, "در حال اجرا"),
        (STATUS_SUCCESS, "موفق"),
        (STATUS_FAILED, "ناموفق"),
    ]

    TRIGGER_MANUAL = "manual"
    TRIGGER_SCHEDULED = "scheduled"
    TRIGGER_CHOICES = [
        (TRIGGER_MANUAL, "دستی (پنل)"),
        (TRIGGER_SCHEDULED, "زمان‌بندی‌شده"),
    ]

    triggered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_runs",
    )
    trigger_type = models.CharField(
        max_length=16, choices=TRIGGER_CHOICES, default=TRIGGER_MANUAL
    )
    status = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default=STATUS_RUNNING
    )
    sources = models.JSONField(default=list)

    found_count = models.PositiveIntegerField(default=0)
    existing_skipped = models.PositiveIntegerField(default=0)
    blacklisted_skipped = models.PositiveIntegerField(default=0)
    created_movies = models.PositiveIntegerField(default=0)
    created_series = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    errors = models.JSONField(default=list, blank=True)

    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]

    @property
    def created_total(self):
        return self.created_movies + self.created_series

    def __str__(self):
        return f"اجرای {self.id} ({self.get_status_display()})"


class AgentImportedItem(TimeStampedModel):
    """هر اثری که ایجنت آورده و وضعیت بررسی‌اش.

    رد شده‌ها هم نگه داشته می‌شوند تا ایجنت دوباره همان اثر را نیاورد
    (لیست سیاه). حذف این ردیف از دیتابیس یعنی اجازه‌ی آوردن دوباره.
    """

    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_PENDING, "در انتظار بررسی"),
        (STATUS_APPROVED, "تأیید شده"),
        (STATUS_REJECTED, "رد شده"),
    ]

    MEDIA_MOVIE = "movie"
    MEDIA_SERIES = "series"
    MEDIA_CHOICES = [(MEDIA_MOVIE, "فیلم"), (MEDIA_SERIES, "سریال")]

    run = models.ForeignKey(
        AgentRun, on_delete=models.CASCADE, related_name="items"
    )
    media_type = models.CharField(max_length=8, choices=MEDIA_CHOICES)
    tmdb_id = models.PositiveIntegerField(db_index=True)
    imdb_id = models.CharField(max_length=20, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)

    title = models.CharField(max_length=255)
    original_title = models.CharField(max_length=255, blank=True)
    year = models.PositiveIntegerField(null=True, blank=True)
    rating = models.FloatField(null=True, blank=True)
    poster_url = models.URLField(blank=True)

    status = models.CharField(
        max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_agent_items",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["media_type", "tmdb_id"], name="unique_agent_item_per_media"
            )
        ]

    def __str__(self):
        return f"{self.title} ({self.get_media_type_display()})"
