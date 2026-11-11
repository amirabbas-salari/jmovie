from django.db import models
from django.utils.text import slugify
from django.utils import timezone
from django.contrib.contenttypes.fields import GenericRelation


from core.models import TimeStampedModel
from genres.models import Genre
from people.models import Person


# --------------------------------------------------
# Series
# --------------------------------------------------
class Series(TimeStampedModel):
    imdb_id = models.CharField(
        max_length=20,
        unique=True,
        db_index=True,
        help_text="IMDb or TMDB ID"
    )
    
    
    downloads = GenericRelation(
        "downloads.Download",
        related_query_name="series"
    )
    

    comments = GenericRelation(
        "comments.Comment",
        related_query_name="series"
    )



    title = models.CharField(max_length=255)
    original_title = models.CharField(
        max_length=255,
        blank=True,
        null=True
    )

    slug = models.SlugField(
        max_length=255,
        unique=True,
        blank=True
    )

    description = models.TextField(blank=True)

    start_date = models.DateField(
        blank=True,
        null=True,
        help_text="First air date"
    )
    @property
    def year(self):
        return self.start_date.year if self.start_date else None
    
    
    end_date = models.DateField(
        blank=True,
        null=True,
        help_text="Last air date (null if ongoing)"
    )

    imdb_rating = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        blank=True,
        null=True
    )
    imdb_votes = models.PositiveIntegerField(
        blank=True,
        null=True
    )

    poster = models.ImageField(
        upload_to="series/posters/",
        blank=True,
        null=True
    )
    backdrop = models.ImageField(
        upload_to="series/backdrops/",
        blank=True,
        null=True
    )
    
    poster_url = models.URLField(
        blank=True,
        null=True
    )

    backdrop_url = models.URLField(
        blank=True,
        null=True
    )

    genres = models.ManyToManyField(
        Genre,
        related_name="series"
    )

    views = models.PositiveBigIntegerField(default=0)

    is_ended = models.BooleanField(
        default=False,
        help_text="Whether the series has ended"
    )

    # هم‌معنای Movie.is_active: پیش‌نویس‌های ایجنت با False ذخیره و با
    # تأیید ادمین True می‌شوند؛ ویوهای عمومی فقط فعال‌ها را نشان می‌دهند.
    is_active = models.BooleanField(default=True)
    
    number_of_seasons = models.PositiveSmallIntegerField(
        null=True,
        blank=True
    )

    number_of_episodes = models.PositiveIntegerField(
        null=True,
        blank=True
    )
    
    tmdb_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        db_index=True
    )

    class Meta:
        ordering = ["-start_date", "-created_at"]
        indexes = [
            models.Index(fields=["imdb_id"]),
            models.Index(fields=["slug"]),
            models.Index(fields=["-imdb_rating"]),
            # مرتب‌سازی پیش‌فرض لیست (-start_date) از این ایندکس می‌خواند
            models.Index(fields=["-start_date"]),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(
                f"{self.original_title}-{self.imdb_id}"
            )   
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


# --------------------------------------------------
# Season
# --------------------------------------------------
class Season(TimeStampedModel):
    series = models.ForeignKey(
        Series,
        on_delete=models.CASCADE,
        related_name="seasons"
    )

    season_number = models.PositiveSmallIntegerField()
    title = models.CharField(
        max_length=255,
        blank=True
    )

    description = models.TextField(blank=True)

    release_date = models.DateField(
        blank=True,
        null=True
    )

    poster = models.ImageField(
        upload_to="series/seasons/",
        blank=True,
        null=True
    )

    class Meta:
        unique_together = ("series", "season_number")
        ordering = ["season_number"]

    def __str__(self):
        return f"{self.series.title} - Season {self.season_number}"


# --------------------------------------------------
# Episode
# --------------------------------------------------
class Episode(TimeStampedModel):
    season = models.ForeignKey(
        Season,
        on_delete=models.CASCADE,
        related_name="episodes"
    )
    
    
    downloads = GenericRelation(
        "downloads.Download",
        related_query_name="series"
    )
    
    comments = GenericRelation(
        "comments.Comment",
        related_query_name="episodes"
    )



    episode_number = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=255)

    description = models.TextField(blank=True)

    runtime = models.PositiveSmallIntegerField(
        blank=True,
        null=True,
        help_text="Runtime in minutes"
    )

    air_date = models.DateField(
        blank=True,
        null=True
    )
    
    tmdb_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        db_index=True
    )

    vote_average = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        null=True,
        blank=True
    )

    vote_count = models.PositiveIntegerField(
        null=True,
        blank=True
    )

    still_image = models.ImageField(
        upload_to="series/episodes/",
        blank=True,
        null=True
    )
    
    still_image_url = models.URLField(
        blank=True,
        null=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("season", "episode_number")
        ordering = ["episode_number"]
        indexes = [
            models.Index(fields=["episode_number"]),
        ]

    def __str__(self):
        return f"S{self.season.season_number}E{self.episode_number} - {self.title}"


# --------------------------------------------------
# Series Cast
# --------------------------------------------------
class SeriesCast(TimeStampedModel):
    ROLE_CHOICES = (
        ("actor", "Actor"),
        ("director", "Director"),
        ("writer", "Writer"),
    )

    series = models.ForeignKey(
        Series,
        on_delete=models.CASCADE,
        related_name="cast"
    )

    person = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        related_name="series_roles"
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES
    )

    character_name = models.CharField(
        max_length=255,
        blank=True,
        null=True
    )

    class Meta:
        unique_together = ("series", "person", "role")
        indexes = [
            models.Index(fields=["role"]),
        ]

    def __str__(self):
        return f"{self.person.name} - {self.role} ({self.series.title})"









# ---------------------------
# series Gallery
# ---------------------------
class SeriesGalleryImage(models.Model):
    series = models.ForeignKey(
        Series,
        on_delete=models.CASCADE,
        related_name="gallery",
    )
    image = models.ImageField(upload_to="series/gallery/")
    image_url = models.URLField(null=True, blank=True)
    caption = models.CharField(max_length=255, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        verbose_name = "تصویر گالری"
        verbose_name_plural = "تصاویر گالری"

    def __str__(self):
        return f"{self.series.title} - {self.order}"