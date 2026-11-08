from rest_framework import serializers

from .models import Series, Season, Episode, SeriesCast, SeriesGalleryImage
from genres.serializers import GenreMinimalSerializer
from people.serializers import PersonSerializer
from downloads.serializers import DownloadSerializer


class SeriesListSerializer(serializers.ModelSerializer):
    genres = GenreMinimalSerializer(many=True)
    # در لیست فقط چند خط اول توضیح نمایش داده می‌شود؛ متن کامل در دیتیل است.
    description = serializers.SerializerMethodField()

    def get_description(self, obj):
        from movies.serializers import truncate_description

        return truncate_description(obj.description)

    class Meta:
        model = Series
        fields = [
            "id",
            "title",
            "original_title",
            "slug",
            # "poster",
            "poster_url",
            "backdrop_url",
            "year",
            "imdb_rating",
            "genres",
            "description",
        ]


class SeriesCastSerializer(serializers.ModelSerializer):
    person = PersonSerializer()

    class Meta:
        model = SeriesCast
        fields = [
            "person",
            "role",
            "character_name",
            # "order",
        ]


class EpisodeSerializer(serializers.ModelSerializer):
    downloads = DownloadSerializer(many=True, read_only=True)

    class Meta:
        model = Episode
        fields = "__all__"


class SeasonSerializer(serializers.ModelSerializer):
    episodes = EpisodeSerializer(many=True)

    class Meta:
        model = Season
        fields = "__all__"




class SeriesGallerySerializer(serializers.ModelSerializer):
    class Meta:
        model = SeriesGalleryImage
        fields = ["id", "image","image_url", "caption", "order"]




class SeriesDetailSerializer(serializers.ModelSerializer):
    genres = GenreMinimalSerializer(many=True)
    cast = SeriesCastSerializer(many=True)
    seasons = SeasonSerializer(many=True)
    gallery = SeriesGallerySerializer(
        many=True,
        read_only=True
    )

    class Meta:
        model = Series
        fields = "__all__"





