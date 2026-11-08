from rest_framework import serializers
from drf_spectacular.utils import (
    extend_schema_field,
    PolymorphicProxySerializer,
)




from movies.models import Movie
from series.models import Series

from movies.serializers import MovieListSerializer
from series.serializers import SeriesListSerializer

from .models import (
    Collection,
    CollectionItem,
)


class CollectionItemSerializer(
    serializers.ModelSerializer
):

    media = serializers.SerializerMethodField()

    class Meta:

        model = CollectionItem

        fields = (
            "id",
            "order",
            "media",
        )

    def get_media(self, obj):

        # media_type را صریح برمی‌گردانیم تا فرانت‌اند (ناوبری کارت و
        # دکمه‌های لیست علاقه‌مندی/تماشا) مجبور به حدس‌زدن نوع آیتم نباشد.
        if isinstance(
            obj.content_object,
            Movie
        ):

            return {
                **MovieListSerializer(
                    obj.content_object,
                    context=self.context,
                ).data,
                "media_type": "movie",
            }

        if isinstance(
            obj.content_object,
            Series
        ):

            return {
                **SeriesListSerializer(
                    obj.content_object,
                    context=self.context,
                ).data,
                "media_type": "series",
            }

        return None


class CollectionListSerializer(
    serializers.ModelSerializer
):

    items_count = serializers.IntegerField(
        read_only=True,
    )
    
    items_preview = serializers.SerializerMethodField()


    class Meta:

        model = Collection

        fields = (
            "id",
            "title",
            "slug",
            "poster",
            "poster_url",
            "backdrop_url",
            "items_count",
            "items_preview",
        )
    
    
    @extend_schema_field(
        PolymorphicProxySerializer(
            component_name="CollectionMedia",
            serializers=[
                MovieListSerializer,
                SeriesListSerializer,
            ],
            resource_type_field_name=None,
        )
    )
    def get_items_preview(self, obj):

        items = obj.items.all().order_by("order")[:4]

        return CollectionItemSerializer(
            items,
            many=True,
            context=self.context,
        ).data


class CollectionDetailSerializer(
    serializers.ModelSerializer
):

    items = CollectionItemSerializer(
        many=True,
        read_only=True,
    )
    
    items_count = serializers.IntegerField(
        read_only=True,
    )

    class Meta:

        model = Collection

        fields = (
            "id",
            "title",
            "slug",
            "description",
            "poster",
            "poster_url",
            "backdrop",
            "backdrop_url",
            "items",
            "items_count",
        )