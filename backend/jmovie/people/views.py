from rest_framework import permissions
from rest_framework.viewsets import ReadOnlyModelViewSet

from .models import Person
from .serializers import PersonListSerializer, PersonSerializer
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page


@method_decorator(cache_page(60 * 2), name="list")
class PersonViewSet(ReadOnlyModelViewSet):
    permission_classes = [permissions.AllowAny]

    lookup_field = "slug"

    def get_queryset(self):
        if self.action == "list":
            # لیست فقط فیلدهای کارت را می‌خواهد؛ نه گالری، نه بیوگرافی.
            return Person.objects.only(
                "id",
                "tmdb_id",
                "name",
                "original_name",
                "slug",
                "profile_image",
                "profile_image_url",
                "popularity",
            )
        return Person.objects.prefetch_related("images").all()

    def get_serializer_class(self):
        return PersonListSerializer if self.action == "list" else PersonSerializer
