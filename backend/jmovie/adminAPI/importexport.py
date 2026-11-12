"""ایمپورت/اکسپورت JSON فیلم‌ها و سریال‌ها برای پنل مدیریت.

فرمت فایل (نسخه‌ی ۱):
    {
      "type": "movie" | "series",
      "version": 1,
      "items": [ { ... }, ... ]
    }

هر آیتم با `imdb_id` شناخته می‌شود: اگر اثری با آن IMDb ID از قبل باشد
به‌روزرسانی می‌شود، وگرنه ساخته می‌شود (پس ایمپورت دوباره‌ی همان فایل
تکراری نمی‌سازد). ژانرها با tmdb_id یا نام، و افراد با tmdb_id یا نام
به رکوردهای موجود وصل می‌شوند و در صورت نبودن ساخته می‌شوند.

برای سریال، فصل‌ها و قسمت‌ها با (season_number, episode_number) شناخته و
به‌صورت merge وارد می‌شوند؛ یعنی فصل/قسمتی که در فایل نیست حذف نمی‌شود.
فقط وقتی کلید downloads/gallery/cast در آیتم باشد، همان بخش جایگزین
می‌شود؛ نبودن کلید یعنی «دست نزن».
"""
import datetime

from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.utils.text import slugify

from downloads.models import Download
from genres.models import Genre
from movies.models import Movie, MovieCast, MovieGalleryImage
from people.models import Person
from series.models import Episode, Season, Series, SeriesCast, SeriesGalleryImage

EXPORT_VERSION = 1


# ---------------------------------------------------------------------------
# خروجی (Export)
# ---------------------------------------------------------------------------
def _date(v):
    return v.isoformat() if v else None


def _download_dict(d):
    return {
        "title": d.title or "",
        "quality": d.quality,
        "language": d.language,
        "subtitle": d.subtitle,
        "size": d.size or "",
        "url": d.url,
        "is_vip": d.is_vip,
        "is_active": d.is_active,
    }


def _downloads_of(model, obj_id):
    ct = ContentType.objects.get_for_model(model)
    return [
        _download_dict(d)
        for d in Download.objects.filter(content_type=ct, object_id=obj_id).order_by("id")
    ]


def _genres_of(obj):
    return [
        {"name": g.name, "slug": g.slug, "tmdb_id": g.tmdb_id} for g in obj.genres.all()
    ]


def _cast_of(cast_qs):
    return [
        {
            "tmdb_id": c.person.tmdb_id,
            "name": c.person.name,
            "role": c.role,
            "character_name": c.character_name or "",
        }
        for c in cast_qs
    ]


def _gallery_of(gallery_qs):
    return [
        {"image_url": g.image_url, "caption": g.caption or "", "order": g.order}
        for g in gallery_qs
        if g.image_url
    ]


def export_movie(movie):
    return {
        "title": movie.title,
        "original_title": movie.original_title or "",
        "description": movie.description or "",
        "imdb_id": movie.imdb_id,
        "tmdb_id": movie.tmdb_id,
        "release_date": _date(movie.release_date),
        "runtime": movie.runtime,
        "imdb_rating": float(movie.imdb_rating) if movie.imdb_rating is not None else None,
        "imdb_votes": movie.imdb_votes,
        "country": movie.country or "",
        "poster_url": movie.poster_url or "",
        "backdrop_url": movie.backdrop_url or "",
        "is_active": movie.is_active,
        "genres": _genres_of(movie),
        "cast": _cast_of(movie.movie_cast.select_related("person").order_by("id")),
        "gallery": _gallery_of(movie.gallery.all()),
        "downloads": _downloads_of(Movie, movie.id),
    }


def export_series(series):
    seasons = []
    for season in series.seasons.all().order_by("season_number"):
        episodes = []
        for ep in season.episodes.all().order_by("episode_number"):
            episodes.append({
                "episode_number": ep.episode_number,
                "title": ep.title or "",
                "description": ep.description or "",
                "runtime": ep.runtime,
                "air_date": _date(ep.air_date),
                "tmdb_id": ep.tmdb_id,
                "downloads": _downloads_of(Episode, ep.id),
            })
        seasons.append({
            "season_number": season.season_number,
            "title": season.title or "",
            "description": season.description or "",
            "release_date": _date(season.release_date),
            "episodes": episodes,
        })
    return {
        "title": series.title,
        "original_title": series.original_title or "",
        "description": series.description or "",
        "imdb_id": series.imdb_id,
        "tmdb_id": series.tmdb_id,
        "start_date": _date(series.start_date),
        "end_date": _date(series.end_date),
        "imdb_rating": float(series.imdb_rating) if series.imdb_rating is not None else None,
        "imdb_votes": series.imdb_votes,
        "poster_url": series.poster_url or "",
        "backdrop_url": series.backdrop_url or "",
        "is_ended": series.is_ended,
        "is_active": series.is_active,
        "number_of_seasons": series.number_of_seasons,
        "number_of_episodes": series.number_of_episodes,
        "genres": _genres_of(series),
        "cast": _cast_of(series.cast.select_related("person").order_by("id")),
        "gallery": _gallery_of(series.gallery.all()),
        "downloads": _downloads_of(Series, series.id),
        "seasons": seasons,
    }


# ---------------------------------------------------------------------------
# ورودی (Import)
# ---------------------------------------------------------------------------
def _parse_date(value):
    if not value:
        return None
    if isinstance(value, datetime.date):
        return value
    return datetime.date.fromisoformat(str(value)[:10])


def _unique_genre_slug(name, tmdb_id=None):
    base = slugify(name) or (f"tmdb-{tmdb_id}" if tmdb_id else "genre")
    slug = base
    n = 2
    while Genre.objects.filter(slug=slug).exists():
        slug = f"{base}-{n}"
        n += 1
    return slug


def _resolve_genre(item):
    tmdb_id = item.get("tmdb_id") if isinstance(item, dict) else None
    name = (item.get("name") if isinstance(item, dict) else str(item)) or ""
    if tmdb_id:
        genre, _ = Genre.objects.get_or_create(
            tmdb_id=tmdb_id,
            defaults={"name": name or f"ژانر {tmdb_id}", "slug": _unique_genre_slug(name, tmdb_id)},
        )
        return genre
    if not name:
        return None
    genre = Genre.objects.filter(name=name).first()
    if genre is None:
        genre = Genre.objects.create(name=name, slug=_unique_genre_slug(name))
    return genre


def _resolve_person(item):
    tmdb_id = item.get("tmdb_id")
    name = item.get("name") or ""
    if tmdb_id:
        person, _ = Person.objects.get_or_create(
            tmdb_id=str(tmdb_id), defaults={"name": name or str(tmdb_id)}
        )
        return person
    if name:
        return Person.objects.filter(name=name).first()
    return None


def _sync_genres(obj, items):
    genres = [g for g in (_resolve_genre(i) for i in items or []) if g]
    obj.genres.set(genres)


def _sync_cast(cast_model, fk_name, obj, items):
    cast_model.objects.filter(**{fk_name: obj}).delete()
    rows = []
    for item in items or []:
        person = _resolve_person(item)
        if person is None:
            continue
        rows.append(cast_model(
            **{fk_name: obj},
            person=person,
            role=item.get("role") or "actor",
            character_name=item.get("character_name") or "",
        ))
    cast_model.objects.bulk_create(rows)


def _sync_gallery(gallery_model, fk_name, obj, items):
    gallery_model.objects.filter(**{fk_name: obj}).delete()
    rows = []
    for i, item in enumerate(items or []):
        if isinstance(item, str):
            url, caption, order = item, "", i
        else:
            url = item.get("image_url") or item.get("url") or ""
            caption = item.get("caption") or ""
            order = item.get("order", i)
        if url:
            rows.append(gallery_model(
                **{fk_name: obj}, image_url=url, caption=caption, order=order,
            ))
    gallery_model.objects.bulk_create(rows)


def _sync_downloads(model, obj_id, items):
    ct = ContentType.objects.get_for_model(model)
    Download.objects.filter(content_type=ct, object_id=obj_id).delete()
    rows = []
    for item in items or []:
        url = (item.get("url") or "").strip()
        if not url:
            continue
        rows.append(Download(
            content_type=ct,
            object_id=obj_id,
            title=item.get("title") or "",
            quality=item.get("quality") or "720p",
            language=item.get("language") or "original",
            subtitle=bool(item.get("subtitle", False)),
            size=item.get("size") or "",
            url=url,
            is_vip=bool(item.get("is_vip", False)),
            is_active=bool(item.get("is_active", True)),
        ))
    Download.objects.bulk_create(rows)


def _scalar_defaults(data, fields):
    """فقط کلیدهایی که در فایل آمده‌اند را برمی‌گرداند تا ایمپورت ناقص،
    فیلدهای موجود را پاک نکند."""
    defaults = {}
    for field in fields:
        if field in data and data[field] is not None:
            defaults[field] = data[field]
    return defaults


@transaction.atomic
def import_movie_item(data):
    imdb_id = str(data.get("imdb_id") or "").strip()
    if not imdb_id:
        raise ValueError("imdb_id الزامی است.")
    defaults = _scalar_defaults(data, [
        "title", "original_title", "description", "tmdb_id", "runtime",
        "imdb_rating", "imdb_votes", "country", "poster_url", "backdrop_url",
        "is_active",
    ])
    if "title" not in defaults:
        defaults["title"] = data.get("original_title") or imdb_id
    if "release_date" in data:
        defaults["release_date"] = _parse_date(data.get("release_date"))
    if not Movie.objects.filter(imdb_id=imdb_id).exists() and not defaults.get("runtime"):
        raise ValueError("برای ساخت فیلم جدید، runtime (مدت زمان) لازم است.")
    movie, created = Movie.objects.update_or_create(imdb_id=imdb_id, defaults=defaults)
    if "genres" in data:
        _sync_genres(movie, data.get("genres"))
    if "cast" in data:
        _sync_cast(MovieCast, "movie", movie, data.get("cast"))
    if "gallery" in data:
        _sync_gallery(MovieGalleryImage, "movie", movie, data.get("gallery"))
    if "downloads" in data:
        _sync_downloads(Movie, movie.id, data.get("downloads"))
    return movie, created


@transaction.atomic
def import_series_item(data):
    imdb_id = str(data.get("imdb_id") or "").strip()
    if not imdb_id:
        raise ValueError("imdb_id الزامی است.")
    defaults = _scalar_defaults(data, [
        "title", "original_title", "description", "tmdb_id",
        "imdb_rating", "imdb_votes", "poster_url", "backdrop_url",
        "is_ended", "is_active", "number_of_seasons", "number_of_episodes",
    ])
    if "title" not in defaults:
        defaults["title"] = data.get("original_title") or imdb_id
    if "start_date" in data:
        defaults["start_date"] = _parse_date(data.get("start_date"))
    if "end_date" in data:
        defaults["end_date"] = _parse_date(data.get("end_date"))
    series, created = Series.objects.update_or_create(imdb_id=imdb_id, defaults=defaults)
    if "genres" in data:
        _sync_genres(series, data.get("genres"))
    if "cast" in data:
        _sync_cast(SeriesCast, "series", series, data.get("cast"))
    if "gallery" in data:
        _sync_gallery(SeriesGalleryImage, "series", series, data.get("gallery"))
    if "downloads" in data:
        _sync_downloads(Series, series.id, data.get("downloads"))
    for season_data in data.get("seasons") or []:
        season_number = season_data.get("season_number")
        if season_number is None:
            continue
        season, _ = Season.objects.update_or_create(
            series=series,
            season_number=season_number,
            defaults={
                "title": season_data.get("title") or "",
                "description": season_data.get("description") or "",
                "release_date": _parse_date(season_data.get("release_date")),
            },
        )
        for ep_data in season_data.get("episodes") or []:
            episode_number = ep_data.get("episode_number")
            if episode_number is None:
                continue
            episode, _ = Episode.objects.update_or_create(
                season=season,
                episode_number=episode_number,
                defaults={
                    "title": ep_data.get("title") or "",
                    "description": ep_data.get("description") or "",
                    "runtime": ep_data.get("runtime"),
                    "air_date": _parse_date(ep_data.get("air_date")),
                    "tmdb_id": ep_data.get("tmdb_id"),
                },
            )
            if "downloads" in ep_data:
                _sync_downloads(Episode, episode.id, ep_data.get("downloads"))
    return series, created


def extract_items(payload):
    """بدنه‌ی ایمپورت می‌تواند {items:[...]} یا [...] یا یک آیتم تکی باشد."""
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        if isinstance(payload.get("items"), list):
            return payload["items"]
        if payload.get("imdb_id"):
            return [payload]
    return None
