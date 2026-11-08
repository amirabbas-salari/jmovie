from rest_framework import generics
from django.db.models import Count, Prefetch
from django.db.models import prefetch_related_objects
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework.filters import OrderingFilter, SearchFilter

from movies.models import Movie
from series.models import Series

from .models import Collection, CollectionItem
from .serializers import (
    CollectionListSerializer,
    CollectionDetailSerializer,
)


def _prefetch_preview_genres(collections):
    """ژانرهای آیتم‌های کالکشن را یکجا می‌خواند.

    content_object یک GenericForeignKey است و نمی‌شود genres را از مسیر
    آن prefetch کرد؛ پس فیلم‌ها و سریال‌های لودشده را جمع می‌کنیم و
    ژانر هر گروه را با یک کوئری می‌خوانیم تا سریالایزر برای هر آیتم
    کوئری جدا نزند.
    """
    movies, series = [], []
    for collection in collections:
        for item in collection.items.all():
            obj = item.content_object
            if isinstance(obj, Movie):
                movies.append(obj)
            elif isinstance(obj, Series):
                series.append(obj)
    if movies:
        prefetch_related_objects(movies, "genres")
    if series:
        prefetch_related_objects(series, "genres")


def _items_prefetch():
    return Prefetch(
        "items",
        queryset=CollectionItem.objects.order_by("order", "id").prefetch_related(
            "content_object"
        ),
    )


@method_decorator(cache_page(60 * 2), name="get")
class CollectionListView(
    generics.ListAPIView
):

    serializer_class = CollectionListSerializer

    filter_backends = [
        SearchFilter,
        OrderingFilter,
    ]

    search_fields = ["title"]

    ordering_fields = [
        "title",
        "items_count",
        "id",
    ]

    queryset = (
        Collection.objects
        .annotate(
            items_count=Count("items")
        )
        .prefetch_related(_items_prefetch())
    )

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        objects = page if page is not None else queryset
        _prefetch_preview_genres(objects)
        serializer = self.get_serializer(objects, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        from rest_framework.response import Response

        return Response(serializer.data)


class CollectionDetailView(
    generics.RetrieveAPIView
):

    serializer_class = CollectionDetailSerializer

    lookup_field = "slug"

    queryset = (
        Collection.objects
        .annotate(
            items_count=Count("items")
        )
        .filter(is_active=True)
        .prefetch_related(_items_prefetch())
    )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        _prefetch_preview_genres([instance])
        serializer = self.get_serializer(instance)
        from rest_framework.response import Response

        return Response(serializer.data)
