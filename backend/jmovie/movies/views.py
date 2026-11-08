from django.core.cache import cache
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.db.models import Prefetch
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiTypes,
    extend_schema,
)
from rest_framework import permissions, viewsets
from rest_framework.response import Response

from core.cache_keys import movie_detail_cache_key
from movies.filters import MovieFilter
from movies.models import Movie, MovieCast
from movies.serializers import MovieDetailSerializer, MovieListSerializer
from movies.throttles import MovieThrottle, MovieAnonThrottle


class MovieViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Movie API

    - List movies
    - Retrieve movie details (cached, VIP-aware)
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = [MovieThrottle, MovieAnonThrottle]

    queryset = Movie.objects.all()
    lookup_field = "slug"

    filterset_class = MovieFilter

    search_fields = [
        "title",
        "original_title",
        # "description",
        "imdb_id",
    ]

    ordering_fields = [
        "release_date",
        "rating",
        "created_at",
        "imdb_rating",
    ]
    ordering = ["-release_date"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == "list":
            # سریالایزر لیست فقط ژانرها را لازم دارد؛ پریفچ عوامل و دانلودها
            # در لیست فقط کوئری و حجم پاسخ را سنگین می‌کرد.
            return qs.prefetch_related("genres").distinct()
        return (
            qs
            .prefetch_related(
                "genres",
                Prefetch(
                    "movie_cast",
                    queryset=MovieCast.objects
                    .select_related("person")
                    .order_by("id"),
                ),
                "downloads",
            )
            .distinct()
        )

    def get_serializer_class(self):
        return (
            MovieListSerializer
            if self.action == "list"
            else MovieDetailSerializer
        )

    @extend_schema(
        summary="List movies",
        description="Retrieve a list of movies with filtering, searching and ordering.",
        parameters=[
            OpenApiParameter("search", OpenApiTypes.STR),
            OpenApiParameter("ordering", OpenApiTypes.STR),
            OpenApiParameter("genres", OpenApiTypes.STR),
            OpenApiParameter("year", OpenApiTypes.INT),
            OpenApiParameter("rating", OpenApiTypes.NUMBER),
        ],
        responses={200: MovieListSerializer(many=True)},
    )
    @method_decorator(cache_page(60 * 2))
    def list(self, request, *args, **kwargs):
        # لیست عمومی است و داده‌ی کاربر-خاص ندارد؛ ۲ دقیقه کش سمت سرور
        return super().list(request, *args, **kwargs)

    @extend_schema(
        summary="Retrieve movie details",
        description=(
            "Retrieve detailed movie information.\n\n"
            "- Cached for 10 minutes\n"
            "- Download links are visible **only for VIP users**"
        ),
        responses={200: MovieDetailSerializer},
    )
    def retrieve(self, request, *args, **kwargs):
        movie = self.get_object()

        is_vip = (
            request.user.is_authenticated
            and getattr(request.user, "is_vip", False)
        )

        cache_key = movie_detail_cache_key(movie.slug, is_vip)
        cached_data = cache.get(cache_key)

        if cached_data is not None:
            return Response(cached_data)

        serializer = self.get_serializer(
            movie,
            context={"request": request},
        )
        data = serializer.data

        cache.set(cache_key, data, timeout=600)
        return Response(data)


