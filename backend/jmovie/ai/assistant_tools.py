"""ابزارهای کاتالوگ برای دستیار سینمایی (صوتی/متنی).

همه‌ی دسترسی دستیار و ایجنت صوتی به کاتالوگ فقط از این توابع می‌گذرد؛
LLM هرگز مستقیم به دیتابیس وصل نمی‌شود. خروجی‌ها ساخت‌یافته و سبک‌اند
تا هم کارت‌های فرانت ساخته شوند هم متن قابل خواندن برای مدل/صدا.

فقط آثار فعال (is_active=True) برمی‌گردند و هیچ فیلدی ساخته/حدس زده
نمی‌شود؛ هرچه در دیتابیس نیست، در خروجی هم نیست.
"""
from django.db.models import Count, Q

from movies.models import Movie
from series.models import Series

MAX_LIMIT = 12


def _poster(obj):
    return obj.poster_url or None


def movie_card(m):
    return {
        "id": m.id,
        "media_type": "movie",
        "title": m.title,
        "original_title": m.original_title or "",
        "year": m.year,
        "rating": float(m.imdb_rating) if m.imdb_rating is not None else None,
        "genres": [g.name for g in m.genres.all()],
        "poster_url": _poster(m),
        "runtime": m.runtime,
        "slug": m.slug,
        "url": f"/movie/{m.slug}",
    }


def series_card(s, seasons_count=None):
    return {
        "id": s.id,
        "media_type": "series",
        "title": s.title,
        "original_title": s.original_title or "",
        "year": s.year,
        "rating": float(s.imdb_rating) if s.imdb_rating is not None else None,
        "genres": [g.name for g in s.genres.all()],
        "poster_url": _poster(s),
        "seasons_count": seasons_count,
        "is_ended": s.is_ended,
        "slug": s.slug,
        "url": f"/series/{s.slug}",
    }


def _genre_q(names):
    q = Q()
    for name in names or []:
        if name:
            q |= Q(genres__name__icontains=str(name).strip())
    return q


def _clean_limit(limit, default=8):
    try:
        return max(1, min(int(limit), MAX_LIMIT))
    except (TypeError, ValueError):
        return default


def search_movies(query="", genre=None, genres=None, year=None, min_rating=None,
                  max_runtime=None, country=None, limit=8):
    qs = Movie.objects.filter(is_active=True).prefetch_related("genres")
    if query:
        qs = qs.filter(
            Q(title__icontains=query) | Q(original_title__icontains=query)
            | Q(imdb_id__icontains=query)
        )
    genre_names = genres or ([genre] if genre else [])
    if genre_names:
        qs = qs.filter(_genre_q(genre_names))
    if year:
        qs = qs.filter(year=year)
    if min_rating:
        qs = qs.filter(imdb_rating__gte=min_rating)
    if max_runtime:
        qs = qs.filter(runtime__lte=max_runtime)
    if country:
        qs = qs.filter(country__icontains=country)
    qs = qs.distinct().order_by("-imdb_rating", "-imdb_votes")
    return {"results": [movie_card(m) for m in qs[:_clean_limit(limit)]]}


def search_series(query="", genre=None, genres=None, year=None, min_rating=None, limit=8):
    qs = (
        Series.objects.filter(is_active=True)
        .annotate(_seasons_count=Count("seasons", distinct=True))
        .prefetch_related("genres")
    )
    if query:
        qs = qs.filter(
            Q(title__icontains=query) | Q(original_title__icontains=query)
            | Q(imdb_id__icontains=query)
        )
    genre_names = genres or ([genre] if genre else [])
    if genre_names:
        qs = qs.filter(_genre_q(genre_names))
    if year:
        qs = qs.filter(start_date__year=year)
    if min_rating:
        qs = qs.filter(imdb_rating__gte=min_rating)
    qs = qs.distinct().order_by("-imdb_rating", "-imdb_votes")
    return {
        "results": [
            series_card(s, seasons_count=s._seasons_count)
            for s in qs[:_clean_limit(limit)]
        ]
    }


def find_title(title, media_type=None):
    """بهترین تطابق یک عنوان در کاتالوگ: (نوع, آبجکت) یا (None, None)."""
    title = (title or "").strip()
    if not title:
        return None, None
    candidates = []
    if media_type in (None, "movie"):
        m = (
            Movie.objects.filter(is_active=True)
            .filter(
                Q(title__iexact=title) | Q(original_title__iexact=title)
                | Q(title__icontains=title) | Q(original_title__icontains=title)
            )
            .prefetch_related("genres")
            .order_by("-imdb_rating")
            .first()
        )
        if m:
            candidates.append(("movie", m))
    if media_type in (None, "series"):
        s = (
            Series.objects.filter(is_active=True)
            .filter(
                Q(title__iexact=title) | Q(original_title__iexact=title)
                | Q(title__icontains=title) | Q(original_title__icontains=title)
            )
            .prefetch_related("genres")
            .order_by("-imdb_rating")
            .first()
        )
        if s:
            candidates.append(("series", s))
    if not candidates:
        return None, None

    def exactness(item):
        kind, obj = item
        t = title.lower()
        return (
            (obj.title or "").lower() == t or (obj.original_title or "").lower() == t,
            float(obj.imdb_rating or 0),
        )

    candidates.sort(key=exactness, reverse=True)
    return candidates[0]


def _cast_summary(cast_qs, limit=6):
    actors, directors = [], []
    for c in cast_qs.select_related("person"):
        entry = {"name": c.person.name, "character": c.character_name or ""}
        if c.role == "director":
            directors.append(c.person.name)
        else:
            actors.append(entry)
    return actors[:limit], directors[:3]


def get_title_details(title, media_type=None):
    kind, obj = find_title(title, media_type)
    if obj is None:
        return {"found": False, "title": title}
    if kind == "movie":
        actors, directors = _cast_summary(obj.movie_cast.all())
        data = movie_card(obj)
        data.update({
            "found": True,
            "description": obj.description or "",
            "country": obj.country or "",
            "backdrop_url": obj.backdrop_url or None,
            "cast": actors,
            "directors": directors,
        })
        return data
    actors, directors = _cast_summary(obj.cast.all())
    data = series_card(obj, seasons_count=obj.seasons.count())
    data.update({
        "found": True,
        "description": obj.description or "",
        "backdrop_url": obj.backdrop_url or None,
        "episodes_count": sum(season.episodes.count() for season in obj.seasons.all()),
        "cast": actors,
        "directors": directors,
    })
    return data


def compare_titles(titles):
    items, missing = [], []
    for title in titles or []:
        details = get_title_details(title)
        if details.get("found"):
            items.append(details)
        else:
            missing.append(title)
    return {"items": items, "missing": missing}


def recommend_titles(genres=None, media_type="both", min_rating=None,
                     year_from=None, year_to=None, max_runtime=None,
                     exclude_genres=None, limit=6):
    limit = _clean_limit(limit, default=6)
    results = []
    per_type = limit if media_type in ("movie", "series") else max(3, limit // 2 + 1)

    if media_type in ("both", "movie"):
        qs = Movie.objects.filter(is_active=True).prefetch_related("genres")
        if genres:
            qs = qs.filter(_genre_q(genres))
        if exclude_genres:
            qs = qs.exclude(_genre_q(exclude_genres))
        if min_rating:
            qs = qs.filter(imdb_rating__gte=min_rating)
        if year_from:
            qs = qs.filter(year__gte=year_from)
        if year_to:
            qs = qs.filter(year__lte=year_to)
        if max_runtime:
            qs = qs.filter(runtime__lte=max_runtime)
        results += [movie_card(m) for m in qs.distinct().order_by("-imdb_rating", "-imdb_votes")[:per_type]]

    if media_type in ("both", "series"):
        qs = (
            Series.objects.filter(is_active=True)
            .annotate(_seasons_count=Count("seasons", distinct=True))
            .prefetch_related("genres")
        )
        if genres:
            qs = qs.filter(_genre_q(genres))
        if exclude_genres:
            qs = qs.exclude(_genre_q(exclude_genres))
        if min_rating:
            qs = qs.filter(imdb_rating__gte=min_rating)
        if year_from:
            qs = qs.filter(start_date__year__gte=year_from)
        if year_to:
            qs = qs.filter(start_date__year__lte=year_to)
        results += [
            series_card(s, seasons_count=s._seasons_count)
            for s in qs.distinct().order_by("-imdb_rating", "-imdb_votes")[:per_type]
        ]

    results.sort(key=lambda r: (r["rating"] or 0), reverse=True)
    return {"results": results[:limit]}


def search_similar_titles(title, media_type=None, limit=6):
    kind, obj = find_title(title, media_type)
    if obj is None:
        return {"found": False, "title": title, "results": []}
    genre_ids = list(obj.genres.values_list("id", flat=True))
    base_rating = float(obj.imdb_rating or 0)
    results = []

    def collect(model, card_fn, is_movie):
        qs = (
            model.objects.filter(is_active=True, genres__in=genre_ids)
            .exclude(pk=obj.pk if (is_movie == (kind == "movie")) else None)
            .prefetch_related("genres")
            .distinct()
        )
        scored = []
        for item in qs[:60]:
            shared = len(set(item.genres.values_list("id", flat=True)) & set(genre_ids))
            rating_gap = abs(float(item.imdb_rating or 0) - base_rating)
            scored.append((shared, -rating_gap, item))
        scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
        return [card_fn(item) for _, _, item in scored]

    if kind == "movie":
        results = collect(Movie, movie_card, True)
    else:
        def _card(s):
            return series_card(s, seasons_count=s.seasons.count())
        results = collect(Series, _card, False)
    return {"found": True, "title": obj.title, "results": results[:_clean_limit(limit)]}


# ---------------------------------------------------------------------------
# اجرای ابزار با نام + اعتبارسنجی حداقلی (نقطه‌ی ورود ایجنت صوتی و چت)
# ---------------------------------------------------------------------------
TOOL_FUNCTIONS = {
    "search_movies": search_movies,
    "search_series": search_series,
    "get_title_details": get_title_details,
    "compare_titles": compare_titles,
    "recommend_titles": recommend_titles,
    "search_similar_titles": search_similar_titles,
}


def run_tool(name, arguments=None):
    fn = TOOL_FUNCTIONS.get(name)
    if fn is None:
        raise ValueError(f"ابزار ناشناخته: {name}")
    args = arguments or {}
    if not isinstance(args, dict):
        raise ValueError("arguments باید آبجکت باشد.")
    allowed = fn.__code__.co_varnames[: fn.__code__.co_argcount]
    clean = {k: v for k, v in args.items() if k in allowed}
    return fn(**clean)
