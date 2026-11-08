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
    queryset = Genre.objects.all().order_by("name")
    lookup_field = "slug"
    permission_classes = [permissions.AllowAny]
    
    def get_serializer_class(self):
        return (
            GenreMinimalSerializer
            if self.action == "list"
            else GenreSerializer
        )
