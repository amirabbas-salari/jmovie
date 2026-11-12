import uuid

from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.core.exceptions import ValidationError
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

from core.models import TimeStampedModel
from genres.models import Genre
from movies.models import Movie
from series.models import Series, Episode
from .validators import phone_validator


# ---------------------------
# Upload Path
# ---------------------------
def user_avatar_upload_path(instance, filename):
    """
    از uuid برای نام فایل استفاده می‌شود تا:
      1) به instance.id وابسته نباشیم (که ممکن است هنگام آپلود همزمان با
         ساخت کاربر هنوز None باشد).
      2) نام فایل اصلی (که ممکن است حاوی اطلاعات یا کاراکترهای ناخواسته باشد)
         روی سرور ذخیره نشود.
    """
    ext = filename.split(".")[-1].lower()
    new_filename = f"{uuid.uuid4().hex}.{ext}"
    # از username به‌جای id استفاده می‌کنیم چون همیشه در دسترس است،
    # حتی قبل از اولین save کامل شدن.
    return f"users/avatars/{instance.username or 'tmp'}/{new_filename}"


# ---------------------------
# Custom User Model
# ---------------------------
class User(AbstractUser):
    email = models.EmailField(unique=True)
    phone = models.CharField(
        max_length=15,
        validators=[phone_validator],
        null=True,
        blank=True
    )

    avatar = models.ImageField(
        upload_to=user_avatar_upload_path,
        blank=True,
        null=True,
        default="users/avatars/default.png"
    )

    is_vip = models.BooleanField(default=False)

    favorite_genres = models.ManyToManyField(
        Genre,
        blank=True,
        related_name="users"
    )

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email"]

    def save(self, *args, **kwargs):
        # نرمال‌سازی ایمیل: جلوگیری از رکوردهای تکراری با کیس متفاوت
        # (Test@Gmail.com vs test@gmail.com)
        if self.email:
            self.email = self.__class__.objects.normalize_email(self.email).lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.username


# ---------------------------
# User Lists
# ---------------------------
class UserList(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="lists"
    )
    title = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_public = models.BooleanField(default=False)
    # created_at حذف شد چون TimeStampedModel از قبل آن را فراهم می‌کند
    # (تعریف دوباره‌ی همان فیلد فقط باعث سردرگمی می‌شد)

    class Meta:
        unique_together = ("user", "title")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.user})"


class UserListItem(TimeStampedModel):
    # فقط این مدل‌ها اجازه دارند هدف یک آیتم لیست باشند.
    # چک واقعی هم در سریالایزر (ورودی کاربر) و هم اینجا (سطح مدل/دیتابیس،
    # برای هر مسیری که از سریالایزر عبور نکند) انجام می‌شود.
    ALLOWED_MODELS = ("movie", "series", "episode")

    user_list = models.ForeignKey(
        UserList,
        on_delete=models.CASCADE,
        related_name="items"
    )

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey("content_type", "object_id")

    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user_list", "content_type", "object_id")
        ordering = ["-added_at"]

    def clean(self):
        if self.content_type_id and self.content_type.model not in self.ALLOWED_MODELS:
            raise ValidationError(
                {"content_type": "نوع محتوا مجاز نیست."}
            )

    def save(self, *args, **kwargs):
        # فقط content_type را اعتبارسنجی می‌کنیم (نه کل مدل)، چون full_clean
        # روی همه‌ی فیلدها اجرا می‌شد و می‌توانست رفتار غیرمنتظره ایجاد کند.
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Item in {self.user_list.title}"


# ---------------------------
# Base for Movie/Series status (کاهش تکرار کد)
# ---------------------------
class BaseUserStatus(TimeStampedModel):
    STATUS_WATCHED = "watched"
    STATUS_FAVORITE = "favorite"
    STATUS_WATCH_LATER = "watch_later"

    STATUS_CHOICES = (
        (STATUS_WATCHED, "Watched"),
        (STATUS_FAVORITE, "Favorite"),
        (STATUS_WATCH_LATER, "Watch Later"),
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class MovieUserStatus(BaseUserStatus):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="movie_statuses"
    )
    movie = models.ForeignKey(
        Movie,
        on_delete=models.CASCADE,
        related_name="user_statuses"
    )

    class Meta:
        unique_together = ("user", "movie", "status")
        indexes = [
            models.Index(fields=["user", "status"]),
        ]

    def __str__(self):
        return f"{self.user} - {self.movie} ({self.status})"


class SeriesUserStatus(BaseUserStatus):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="series_statuses"
    )
    series = models.ForeignKey(
        Series,
        on_delete=models.CASCADE,
        related_name="user_statuses"
    )

    class Meta:
        unique_together = ("user", "series", "status")
        indexes = [
            models.Index(fields=["user", "status"]),
        ]

    def __str__(self):
        return f"{self.user} - {self.series} ({self.status})"


# ---------------------------
# Episode Watch Progress
# ---------------------------
class EpisodeWatchStatus(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="watched_episodes"
    )
    episode = models.ForeignKey(
        Episode,
        on_delete=models.CASCADE,
        related_name="watched_by_users"
    )
    # auto_now (نه auto_now_add) چون این رکورد toggle می‌شود (watched/unwatched)
    # و باید هر بار که وضعیت تغییر می‌کند، زمان هم به‌روزرسانی شود.
    watched_at = models.DateTimeField(auto_now=True)
    is_watched = models.BooleanField(default=True)

    class Meta:
        unique_together = ("user", "episode")
        indexes = [
            models.Index(fields=["user"]),
        ]

    def __str__(self):
        return f"{self.user} watched {self.episode}"