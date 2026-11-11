from django.core.cache import cache
from django.db.models import Prefetch
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiTypes,
    extend_schema,
)
from rest_framework import permissions, viewsets
from rest_framework.response import Response

from core.cache_keys import series_detail_cache_key
from series.filters import SeriesFilter
from series.models import Episode, Season, Series, SeriesCast
from series.serializers import SeriesDetailSerializer, SeriesListSerializer
from series.throttles import SeriesThrottle, SeriesAnonThrottle
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page


class SeriesViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Series API

    - List series
    - Retrieve series details (cached, VIP-aware)
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = [SeriesThrottle, SeriesAnonThrottle]

    queryset = Series.objects.all()
    lookup_field = "slug"

    filterset_class = SeriesFilter

    search_fields = [
        "title",
        "original_title",
        "overview",
        "imdb_id",
    ]

    ordering_fields = [
        "start_date",
        "rating",
        "created_at",
    ]
    ordering = ["-start_date"]

    def get_queryset(self):
        # پیش‌نویس‌ها (is_active=False — مثلاً واردشده‌های در انتظار تأیید
        # ایجنت محتوا) هرگز نباید در سایت عمومی دیده شوند.
        qs = super().get_queryset().filter(is_active=True).prefetch_related("genres")

        if self.action == "list":
            # فقط ستون‌های لازم کارت (year از start_date ساخته می‌شود)
            return qs.only(
                "id",
                "title",
                "original_title",
                "slug",
                "poster_url",
                "backdrop_url",
                "start_date",
                "imdb_rating",
                "description",
            )

        return qs.prefetch_related(
            Prefetch(
                "cast",
                queryset=SeriesCast.objects
                .select_related("person")
                .order_by("id"),
            ),
            Prefetch(
                "seasons",
                queryset=Season.objects
                .order_by("season_number")
                .prefetch_related(
                    Prefetch(
                        "episodes",
                        queryset=Episode.objects
                        .order_by("episode_number")
                        .prefetch_related("downloads"),
                    )
                ),
            ),
        )

    def get_serializer_class(self):
        return (
            SeriesListSerializer
            if self.action == "list"
            else SeriesDetailSerializer
        )

    @extend_schema(
        summary="List series",
        description="Retrieve a list of series with filtering, searching and ordering.",
        parameters=[
            OpenApiParameter("search", OpenApiTypes.STR),
            OpenApiParameter("ordering", OpenApiTypes.STR),
            OpenApiParameter("genres", OpenApiTypes.STR),
            OpenApiParameter("year", OpenApiTypes.INT),
            OpenApiParameter("rating", OpenApiTypes.NUMBER),
        ],
        responses={200: SeriesListSerializer(many=True)},
    )
    @method_decorator(cache_page(60 * 2))
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(
        summary="Retrieve series details",
        description=(
            "Retrieve detailed series information including seasons and episodes.\n\n"
            "- Cached for 10 minutes\n"
            "- Download links are visible **only for VIP users**"
        ),
        responses={200: SeriesDetailSerializer},
    )
    def retrieve(self, request, *args, **kwargs):
        series = self.get_object()

        is_vip = (
            request.user.is_authenticated
            and getattr(request.user, "is_vip", False)
        )

        cache_key = series_detail_cache_key(series.slug, is_vip)
        cached_data = cache.get(cache_key)

        if cached_data is not None:
            return Response(cached_data)

        serializer = self.get_serializer(
            series,
            context={"request": request},
        )
        data = serializer.data

        cache.set(cache_key, data, timeout=600)
        return Response(data)

