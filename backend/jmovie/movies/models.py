from django.db import models
from django.utils.text import slugify
from django.contrib.contenttypes.fields import GenericRelation

from core.models import TimeStampedModel
from genres.models import Genre
from people.models import Person


# ---------------------------
# Movie Model
# ---------------------------
class Movie(TimeStampedModel):
    imdb_id = models.CharField(
        max_length=20,
        unique=True,
        db_index=True,
        help_text="IMDb ID (e.g. tt0816692)"
    )
    
    downloads = GenericRelation(
        "downloads.Download",
        related_query_name="movies"
    )
    
    
    comments = GenericRelation(
        "comments.Comment",
        related_query_name="movies"
    )


    title = models.CharField(max_length=255)
    original_title = models.CharField(max_length=255, blank=True)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    
    country = models.CharField(max_length=255, blank=True)

    description = models.TextField(null=True, blank=True)
    release_date = models.DateField(null=True, blank=True)
    year = models.IntegerField(null=True, blank=True)
    # @property
    # def year(self):
    #     if self.release_date:
    #         return self.release_date.year
    #     return None
    
    
    runtime = models.PositiveIntegerField(
        help_text="Duration in minutes"
    )

    imdb_rating = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        null=True,
        blank=True
    )
    
    imdb_votes = models.PositiveIntegerField(default=0)

    poster = models.ImageField(
        upload_to="movies/posters/",
        blank=True,
        null=True
    )
    backdrop = models.ImageField(
        upload_to="movies/backdrops/",
        blank=True,
        null=True
    )

    genres = models.ManyToManyField(
        Genre,
        related_name="movies"
    )

    cast = models.ManyToManyField(
        Person,
        through="MovieCast",
        related_name="movies"
    )

    is_active = models.BooleanField(default=True)
    views = models.PositiveIntegerField(default=0)
    
    
    poster_url = models.URLField(blank=True)
    backdrop_url = models.URLField(blank=True)
    tmdb_id = models.PositiveIntegerField(
        unique=True,
        null=True,
        blank=True
    )
    
    @property
    def comments_count(self):
        return self.comments.filter(
            is_active=True,
            is_approved=True
        ).count()


    class Meta:
        ordering = ["-release_date"] 
        indexes = [
            models.Index(fields=["imdb_id"]),
            models.Index(fields=["slug"]),
            models.Index(fields=["release_date"]),
            # مرتب‌سازی «ترین‌های IMDb» و فیلتر امتیاز بدون اسکن کامل جدول
            models.Index(fields=["-imdb_rating"]),
        ]

    def save(self, *args, **kwargs):
        
        if not self.slug:
            self.slug = slugify(f"{self.original_title}-{self.imdb_id}")
            
        if self.release_date:
            # اگر release_date از نوع DateField باشد، مستقیماً به year دسترسی داریم
            self.year = self.release_date.year
            
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


# ---------------------------
# Movie Cast (Actor / Director / Writer)
# ---------------------------
class MovieCast(TimeStampedModel):
    ROLE_ACTOR = "actor"
    ROLE_DIRECTOR = "director"
    ROLE_WRITER = "writer"

    ROLE_CHOICES = (
        (ROLE_ACTOR, "Actor"),
        (ROLE_DIRECTOR, "Director"),
        (ROLE_WRITER, "Writer"),
    )

    movie = models.ForeignKey(
        Movie,
        on_delete=models.CASCADE,
        related_name="movie_cast"
    )
    person = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        related_name="movie_roles"
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES
    )
    character_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Only for actors"
    )

    class Meta:
        unique_together = ("movie", "person", "role")
        indexes = [
            models.Index(fields=["movie", "role"]),
        ]

    def __str__(self):
        return f"{self.person} - {self.movie} ({self.role})"








# ---------------------------
# Movie Gallery
# ---------------------------
class MovieGalleryImage(models.Model):
    movie = models.ForeignKey(
        Movie,
        on_delete=models.CASCADE,
        related_name="gallery",
    )
    image = models.ImageField(upload_to="movies/gallery/")
    image_url = models.URLField(null=True, blank=True)
    caption = models.CharField(max_length=255, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        verbose_name = "تصویر گالری"
        verbose_name_plural = "تصاویر گالری"

    def __str__(self):
        return f"{self.movie.title} - {self.order}"