from rest_framework import serializers

from .models import Movie, MovieCast, MovieGalleryImage
from genres.serializers import GenreMinimalSerializer
from people.serializers import PersonSerializer
from downloads.serializers import DownloadSerializer
from comments.serializers import CommentSerializer


class MovieGalleryImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = MovieGalleryImage
        fields = ["id", "image","image_url", "caption", "order"]


# توضیح کامل فیلم‌ها گاهی چند کیلوبایت است؛ در لیست/کارت فقط چند خط اول
# نمایش داده می‌شود (line-clamp)، پس متن را سمت سرور کوتاه می‌کنیم تا حجم
# پاسخ لیست‌ها چند برابر کمتر شود. متن کامل در دیتیل دست‌نخورده می‌ماند.
LIST_DESCRIPTION_MAX_CHARS = 240


def truncate_description(text):
    text = (text or "").strip()
    if len(text) <= LIST_DESCRIPTION_MAX_CHARS:
        return text
    return text[:LIST_DESCRIPTION_MAX_CHARS].rstrip() + "…"


class MovieListSerializer(serializers.ModelSerializer):
    genres = GenreMinimalSerializer(many=True)
    description = serializers.SerializerMethodField()

    def get_description(self, obj):
        return truncate_description(obj.description)

    class Meta:
        model = Movie
        fields = [
            "id",
            "title",
            "original_title",
            "year",
            "description",
            "runtime",
            "imdb_rating",
            "slug",
            # "poster",
            "poster_url",
            "backdrop_url",
            "genres",
            "country",
            "release_date",
        ]


class MovieCastSerializer(serializers.ModelSerializer):
    person = PersonSerializer()

    class Meta:
        model = MovieCast
        fields = [
            "person",
            "role",
            "character_name",
            # "order",
        ]


class MovieDetailSerializer(serializers.ModelSerializer):
    genres = GenreMinimalSerializer(many=True)
    # cast = MovieCastSerializer(many=True)
    cast = MovieCastSerializer(
        source="movie_cast",
        many=True,
        read_only=True,
    )
    downloads = DownloadSerializer(many=True, read_only=True)
    gallery = MovieGalleryImageSerializer(many=True, read_only=True)
    

    class Meta:
        model = Movie
        fields = "__all__"
        
        
