from django.db.models import Q
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework.views import APIView
from rest_framework.response import Response

from movies.models import Movie
from series.models import Series
from people.models import Person

from movies.serializers import MovieListSerializer
from series.serializers import SeriesListSerializer
from people.serializers import PersonListSerializer

# سقف نتایج جستجو: بدون سقف، یک کوئری عمومی (مثل «a») می‌توانست کل دیتابیس
# را در یک پاسخ برگرداند. برای جستجوی زنده‌ی هدر ۱۰ تا و برای صفحات
# جستجو ۵۰ تا کافی است.
GLOBAL_SEARCH_LIMIT = 10
MEDIA_SEARCH_LIMIT = 50


def _movie_matches(q):
    return (
        Movie.objects.filter(
            Q(is_active=True),
            Q(title__icontains=q)
            | Q(original_title__icontains=q)
            | Q(imdb_id__icontains=q)
        )
        .prefetch_related("genres")
    )


def _series_matches(q):
    return (
        Series.objects.filter(
            Q(is_active=True),
            Q(title__icontains=q)
            | Q(original_title__icontains=q)
            | Q(imdb_id__icontains=q)
        )
        .prefetch_related("genres")
    )


# نتایج جستجو عمومی و کاربر-خاص نیستند؛ ۶۰ ثانیه کش سمت سرور باعث می‌شود
# تایپ تکراری در سرچ‌بار هدر هر بار به دیتابیس نرسد.
@method_decorator(cache_page(60), name="get")
class GlobalSearchView(APIView):
    def get(self, request):
        q = request.query_params.get("q", "").strip()

        if not q:
            return Response({"movies": [], "series": [], "people": []})

        movies = _movie_matches(q)[:GLOBAL_SEARCH_LIMIT]
        series = _series_matches(q)[:GLOBAL_SEARCH_LIMIT]

        people = Person.objects.filter(
            Q(name__icontains=q)
            | Q(original_name__icontains=q)
        )[:GLOBAL_SEARCH_LIMIT]

        return Response({
            "movies": MovieListSerializer(movies, many=True, context={"request": request}).data,
            "series": SeriesListSerializer(series, many=True, context={"request": request}).data,
            "people": PersonListSerializer(people, many=True, context={"request": request}).data,
        })


@method_decorator(cache_page(60), name="get")
class MovieSearchView(APIView):
    def get(self, request):
        q = request.query_params.get("q", "").strip()

        if not q:
            return Response([])

        movies = _movie_matches(q)[:MEDIA_SEARCH_LIMIT]

        return Response(
            MovieListSerializer(
                movies,
                many=True,
                context={"request": request}
            ).data
        )


@method_decorator(cache_page(60), name="get")
class SeriesSearchView(APIView):
    def get(self, request):
        q = request.query_params.get("q", "").strip()

        if not q:
            return Response([])

        series = _series_matches(q)[:MEDIA_SEARCH_LIMIT]

        return Response(
            SeriesListSerializer(
                series,
                many=True,
                context={"request": request}
            ).data
        )
