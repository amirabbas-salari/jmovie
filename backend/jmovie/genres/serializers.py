from rest_framework import serializers
from .models import Genre


GENRE_MEDIA_LIMIT = 60





class GenreMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Genre
        fields = ("id", "name", "slug")
        



class GenreSerializer(serializers.ModelSerializer):
    
    movies = serializers.SerializerMethodField()
    series = serializers.SerializerMethodField()
    class Meta:
        model = Genre
        fields = (
            "id",
            "name",
            "slug",
            "movies",
            "series",
        )
    
    
    def get_movies(self, obj):
        from movies.serializers import MovieListSerializer

        return MovieListSerializer(
            obj.movies.all(),
            many=True,
            context=self.context
        ).data

    def get_series(self, obj):
        from series.serializers import SeriesListSerializer

        return SeriesListSerializer(
            obj.series.all(),
            many=True,
            context=self.context
        ).data
        
