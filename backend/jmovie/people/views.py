from rest_framework import permissions
from rest_framework.viewsets import ReadOnlyModelViewSet

from .models import Person
from .serializers import PersonSerializer
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page


@method_decorator(cache_page(60 * 2), name="list")
class PersonViewSet(ReadOnlyModelViewSet):
    permission_classes = [permissions.AllowAny]

    queryset = (
        Person.objects
        .prefetch_related("images")
        .all()
    )

    serializer_class = PersonSerializer

    lookup_field = "slug"