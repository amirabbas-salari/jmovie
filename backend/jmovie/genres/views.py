from rest_framework import viewsets, permissions

from .models import Genre
from .serializers import GenreSerializer, GenreMinimalSerializer
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page


@method_decorator(cache_page(60 * 2), name="list")
class GenreViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only API for genres.
    Used in movies and series.
    """
    lookup_field = "slug"
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = Genre.objects.all().order_by("name")
        if self.action == "retrieve":
            # سریالایزر دیتیل فیلم‌ها و سریال‌های ژانر را با ژانرهای خودشان
            # برمی‌گرداند؛ prefetch جلوی N+1 را می‌گیرد.
            return qs.prefetch_related(
                "movies__genres",
                "series__genres",
                "movies",
                "series",
            )
        return qs

    def get_serializer_class(self):
        return (
            GenreMinimalSerializer
            if self.action == "list"
            else GenreSerializer
        )
