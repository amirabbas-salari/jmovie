"""ایجنت محتوای مووی‌ورس.

کار ایجنت:
  ۱) از TMDB فهرست‌های «ترند / جدید / محبوب / برترین‌ها» را می‌گیرد.
  ۲) با دیتابیس سایت مقایسه می‌کند؛ هرچه داریم یا قبلاً رد شده رد می‌شود.
  ۳) برای بقیه، جزئیات کامل (بازیگران، کارگردان، ژانر، پوستر) را می‌آورد
     و به‌صورت «پیش‌نویس غیرفعال» ذخیره می‌کند تا ادمین در پنل تأیید کند.
  ۴) عنوان/خلاصه اگر فارسی آماده نداشت، در صورت فعال بودن با AI ترجمه می‌شود.

اجرا هم از پنل (دستی) می‌شود، هم از cron سرور:
  python manage.py run_content_agent
"""
import logging

from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from genres.models import Genre
from movies.models import Movie, MovieCast, MovieGalleryImage
from movies.services.tmdb import TMDBClient
from people.models import Person
from series.models import Episode, Season, Series, SeriesCast, SeriesGalleryImage

from . import download_source
from .models import AgentImportedItem, AgentRun, AgentSettings
from .translator import contains_persian, translate_to_persian


class AlreadyExists(Exception):
    """اثر با شناسه‌ی دیگری (IMDb) از قبل در سایت هست؛ خطا نیست، ردّ تکراری است."""


class OutOfRange(Exception):
    """تاریخ اکران اثر خارج از بازه‌ی انتخاب‌شده در تنظیمات است."""

logger = logging.getLogger(__name__)

# نگاشت منبع تنظیمات -> اندپوینت‌های TMDB برای فیلم و سریال
SOURCE_ENDPOINTS = {
    "trending": [("movie", "trending/movie/week"), ("tv", "trending/tv/week")],
    "new": [("movie", "movie/now_playing"), ("tv", "tv/on_the_air")],
    "popular": [("movie", "movie/popular"), ("tv", "tv/popular")],
    "top_rated": [("movie", "movie/top_rated"), ("tv", "tv/top_rated")],
}

MAX_PAGES_PER_SOURCE = 50
MAX_CANDIDATES_EXAMINED = 5000
MAX_CAST = 10


def _normalize_media_types(values):
    """زیرمجموعه‌ی معتبر از ['movie', 'series']؛ خالی/نامعتبر یعنی هر دو."""
    allowed = [v for v in (values or []) if v in ("movie", "series")]
    return allowed or ["movie", "series"]


def _domain_media_type(candidate_media_type):
    """نوع کاندیدای TMDB («tv») به نوع دامنه‌ی سایت («series») تبدیل می‌شود."""
    return "movie" if candidate_media_type == "movie" else "series"


def _img(path, size="w500"):
    # بیس‌لینک تصاویر از settings (متغیر محیطی TMDB_IMAGE_BASE_URL) خوانده
    # می‌شود تا پوستر/بک‌گراند/پروفایل ایجنت هم روی همان CDN/پروکسی ساخته شود.
    from django.conf import settings

    base = getattr(settings, "TMDB_IMAGE_BASE_URL", "https://image.tmdb.org/t/p/")
    return f"{base}{size}{path}" if path else ""


def _parse_date(value):
    """TMDB تاریخ را رشته می‌دهد؛ save() مدل‌ها آبجکت date می‌خواهند."""
    if not value:
        return None
    try:
        from datetime import date

        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


class ContentAgent:
    def __init__(self, settings_obj: AgentSettings | None = None):
        self.config = settings_obj or AgentSettings.load()
        self.client = TMDBClient()

    # ---------------- کشف از منبع سفارشی (sitemap/RSS یک سایت) ----------------
    def discover_from_custom_source(self, limit, allowed_media_types=None):
        """از sitemap/RSS منبع فقط «عنوان» آثار خوانده و در TMDB پیدا
        می‌شود. هیچ لینک دانلودی از منبع خوانده یا ذخیره نمی‌شود."""
        import re

        import requests

        allowed = _normalize_media_types(
            allowed_media_types
            if allowed_media_types is not None
            else getattr(self.config, "media_types", None)
        )

        url = (self.config.discovery_source_url or "").strip()
        if not url:
            return []

        def fetch(u):
            resp = requests.get(
                u,
                timeout=20,
                headers={"User-Agent": "MovieVerseAgent/1.0 (+content discovery)"},
            )
            resp.raise_for_status()
            return resp.text

        def titles_from(xml_text):
            locs = re.findall(r"<loc>\s*(.*?)\s*</loc>", xml_text, re.I | re.S)
            titles = []
            # sitemap index: یک لایه فرزندها را هم بخوان
            child_sitemaps = [l for l in locs if l.rstrip("/").endswith(".xml")][:3]
            entries = [l for l in locs if l not in child_sitemaps]
            for child in child_sitemaps:
                try:
                    entries += re.findall(
                        r"<loc>\s*(.*?)\s*</loc>", fetch(child), re.I | re.S
                    )
                except Exception:
                    logger.warning("custom source child sitemap failed: %s", child)
            for loc in entries:
                imdb_match = re.search(r"(tt\d{7,9})", loc)
                segment = loc.rstrip("/").rsplit("/", 1)[-1]
                segment = re.sub(r"\.(html?|php|aspx?)$", "", segment, flags=re.I)
                title = re.sub(r"[-_]+", " ", segment)
                title = re.sub(r"\b(19|20)\d{2}\b", "", title).strip()
                title = re.sub(r"\s+", " ", title)
                if len(title) >= 2:
                    titles.append((title, imdb_match.group(1) if imdb_match else None))
            if not titles:  # RSS: عنوان‌ها داخل <title>
                for raw in re.findall(r"<title>\s*(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?\s*</title>", xml_text, re.I | re.S):
                    raw = raw.strip()
                    if len(raw) >= 2 and "://" not in raw:
                        imdb_match = re.search(r"(tt\d{7,9})", raw)
                        titles.append((raw, imdb_match.group(1) if imdb_match else None))
            return titles

        try:
            pairs = titles_from(fetch(url))
        except Exception:
            logger.warning("custom discovery source failed: %s", url, exc_info=True)
            return []

        candidates = []
        seen = set()
        for title, imdb_id in pairs[:100]:
            resolved = None
            if imdb_id:
                for media_type, finder in (
                    ("movie", self.client.find_movie),
                    ("tv", self.client.find_tv),
                ):
                    try:
                        tmdb_id = finder(imdb_id)
                    except Exception:
                        tmdb_id = None
                    if tmdb_id:
                        resolved = {
                            "media_type": media_type,
                            "tmdb_id": tmdb_id,
                            "vote_average": 10,
                            "vote_count": 10 ** 9,
                        }
                        break
            if resolved is None:
                try:
                    data = self.client._get(
                        "search/multi", {"query": title, "language": "en-US"}
                    )
                except Exception:
                    continue
                for result in data.get("results") or []:
                    if result.get("media_type") in ("movie", "tv") and result.get("id"):
                        raw_date = result.get("release_date") or result.get("first_air_date")
                        if raw_date and not self._release_in_range(raw_date):
                            continue
                        resolved = {
                            "media_type": result["media_type"],
                            "tmdb_id": result["id"],
                            "vote_average": result.get("vote_average") or 0,
                            "vote_count": result.get("vote_count") or 0,
                        }
                        break
            if resolved is None:
                continue
            if _domain_media_type(resolved["media_type"]) not in allowed:
                continue
            if resolved["vote_average"] < self.config.min_rating:
                continue
            if resolved["vote_count"] < self.config.min_votes and not imdb_id:
                continue
            key = (resolved["media_type"], resolved["tmdb_id"])
            if key in seen:
                continue
            seen.add(key)
            candidates.append(resolved)
            if len(candidates) >= limit:
                break
        return candidates

    # ---------------- کشف ----------------
    def _release_in_range(self, date_value):
        """تاریخ اکران (رشته یا date) داخل بازه‌ی تنظیمات هست یا نه.

        وقتی بازه‌ای تنظیم نشده همیشه True است؛ وقتی تنظیم شده، اثری که
        تاریخ ندارد یا خارج از بازه است رد می‌شود.
        """
        start = getattr(self.config, "release_date_from", None)
        end = getattr(self.config, "release_date_to", None)
        if not start and not end:
            return True
        if not date_value:
            return False
        parsed = _parse_date(date_value) if isinstance(date_value, str) else date_value
        if parsed is None:
            return False
        if start and parsed < start:
            return False
        if end and parsed > end:
            return False
        return True

    def discover_iter(self, sources, media_types=None):
        """کاندیداها را صفحه‌به‌صفحه و تنبل yield می‌کند.

        قبلاً فقط ۲ صفحه از هر لیست خوانده می‌شد و برای سقف‌های بزرگ
        (مثلاً ۱۰۰۰ فیلم) کاندیداها وسط راه تمام می‌شدند و بیشترشان هم
        تکراری‌های صفحه‌ی اول بودند؛ حالا تا وقتی اجراکننده به سقفش
        برسد، صفحه‌های عمیق‌تر خوانده می‌شوند.
        """
        allowed = _normalize_media_types(
            media_types
            if media_types is not None
            else getattr(self.config, "media_types", None)
        )
        seen = set()
        examined = 0
        if "custom" in sources:
            for candidate in self.discover_from_custom_source(500, allowed):
                key = (candidate["media_type"], candidate["tmdb_id"])
                if key in seen:
                    continue
                seen.add(key)
                yield candidate
        for source in sources:
            if source == "custom":
                continue
            for media_type, endpoint in SOURCE_ENDPOINTS.get(source, []):
                if _domain_media_type(media_type) not in allowed:
                    continue  # فیلتر نوع اثر (فقط فیلم / فقط سریال)
                for page in range(1, MAX_PAGES_PER_SOURCE + 1):
                    try:
                        data = self.client._get(endpoint, {"page": page, "language": "en-US"})
                    except Exception:
                        logger.warning("TMDB list failed: %s page %s", endpoint, page, exc_info=True)
                        break
                    results = data.get("results") or []
                    if not results:
                        break
                    for item in results:
                        examined += 1
                        if examined > MAX_CANDIDATES_EXAMINED:
                            return
                        tmdb_id = item.get("id")
                        if not tmdb_id:
                            continue
                        key = (media_type, tmdb_id)
                        if key in seen:
                            continue
                        if (item.get("vote_average") or 0) < self.config.min_rating:
                            continue
                        if (item.get("vote_count") or 0) < self.config.min_votes:
                            continue
                        raw_date = item.get("release_date") or item.get("first_air_date")
                        if not self._release_in_range(raw_date):
                            continue
                        seen.add(key)
                        yield {
                            "media_type": media_type,
                            "tmdb_id": tmdb_id,
                            "vote_average": item.get("vote_average") or 0,
                            "vote_count": item.get("vote_count") or 0,
                        }

    def discover(self, sources, limit, media_types=None):
        """نسخه‌ی فهرستی discover_iter (برای سازگاری و تست‌ها)."""
        out = []
        for candidate in self.discover_iter(sources, media_types=media_types):
            out.append(candidate)
            if len(out) >= limit:
                break
        return out

    def _already_have(self, media_type, tmdb_id):
        model = Movie if media_type == "movie" else Series
        return model.objects.filter(tmdb_id=tmdb_id).exists()

    def _blacklisted(self, media_type, tmdb_id):
        return AgentImportedItem.objects.filter(
            media_type=media_type, tmdb_id=tmdb_id
        ).exists()

    # ---------------- ساخت اجزا ----------------
    def _get_or_create_genres(self, tmdb_genres):
        genres = []
        for g in tmdb_genres or []:
            if not g.get("id"):
                continue
            genre = Genre.objects.filter(tmdb_id=g["id"]).first()
            if genre is None and g.get("name"):
                genre = Genre.objects.filter(name=g["name"]).first()
            if genre is None:
                # slugify نام فارسی رشته‌ی خالی می‌دهد و slug تکراری خطای یکتا
                # می‌سازد؛ در این حالت از شناسه‌ی TMDB استفاده می‌شود.
                slug = slugify(g.get("name") or "")[:120] or f"genre-{g['id']}"
                genre = Genre.objects.create(
                    name=g.get("name") or f"ژانر {g['id']}",
                    slug=slug,
                    tmdb_id=g["id"],
                )
            genres.append(genre)
        return genres

    def _get_or_create_person(self, tmdb_person):
        person = Person.objects.filter(tmdb_id=str(tmdb_person["id"])).first()
        profile_url = _img(tmdb_person.get("profile_path"), "w185")
        if person is None:
            person = Person.objects.create(
                tmdb_id=str(tmdb_person["id"]),
                name=tmdb_person.get("name") or "نامشخص",
                profile_image_url=profile_url,
            )
        elif profile_url and not person.profile_image_url:
            # شخص از قبل هست ولی عکس ندارد؛ کاملش می‌کنیم
            person.profile_image_url = profile_url
            person.save(update_fields=["profile_image_url"])
        return person

    def _maybe_translate(self, fa_data, en_data, field_tmdb, is_title=False):
        """متن فارسی آماده از TMDB، وگرنه ترجمه‌ی AI از متن انگلیسی."""
        fa_text = (fa_data.get(field_tmdb) or "").strip()
        if fa_text and contains_persian(fa_text):
            return fa_text
        en_text = (en_data.get(field_tmdb) or "").strip()
        source = fa_text or en_text
        if self.config.translate_with_ai and source:
            translated = translate_to_persian(source, is_title=is_title)
            if translated:
                return translated
        return source

    def _import_series_structure(self, series, tmdb_id, fa, en):
        """فصل‌ها و قسمت‌های سریال از TMDB ساخته می‌شوند (بدون لینک دانلود)."""
        seasons_meta = fa.get("seasons") or en.get("seasons") or []
        for meta in seasons_meta:
            season_number = meta.get("season_number")
            if season_number is None or season_number < 1:
                continue  # فصل صفر (ویژه‌ها) وارد نمی‌شود
            try:
                details = self.client._get(
                    f"tv/{tmdb_id}/season/{season_number}", {"language": "fa-IR"}
                )
            except Exception:
                try:
                    details = self.client.season_details(tmdb_id, season_number)
                except Exception:
                    logger.warning(
                        "season fetch failed: tv=%s season=%s", tmdb_id, season_number,
                        exc_info=True,
                    )
                    details = {}
            season, _created = Season.objects.get_or_create(
                series=series,
                season_number=season_number,
                defaults={
                    "title": details.get("name") or meta.get("name") or "",
                    "description": details.get("overview") or meta.get("overview") or "",
                    "release_date": _parse_date(details.get("air_date") or meta.get("air_date")),
                },
            )
            for ep in details.get("episodes") or []:
                ep_number = ep.get("episode_number")
                if ep_number is None:
                    continue
                vote = ep.get("vote_average")
                Episode.objects.get_or_create(
                    season=season,
                    episode_number=ep_number,
                    defaults={
                        "title": ep.get("name") or f"قسمت {ep_number}",
                        "description": ep.get("overview") or "",
                        "runtime": ep.get("runtime"),
                        "air_date": _parse_date(ep.get("air_date")),
                        "tmdb_id": ep.get("id"),
                        "vote_average": round(float(vote), 1) if vote else None,
                        "vote_count": ep.get("vote_count") or None,
                        "still_image_url": _img(ep.get("still_path"), "w300") or None,
                    },
                )

    def _import_gallery(self, media, is_movie, fa, en):
        """تا ۵ بک‌گراند TMDB به گالری اثر اضافه می‌شود (فقط URL، بدون فایل)."""
        images = fa.get("images") or en.get("images") or {}
        backdrops = [b for b in (images.get("backdrops") or []) if b.get("file_path")][:5]
        if not backdrops:
            return
        gallery_model = MovieGalleryImage if is_movie else SeriesGalleryImage
        fk_name = "movie" if is_movie else "series"
        if gallery_model.objects.filter(**{fk_name: media}).exists():
            return
        for index, backdrop in enumerate(backdrops):
            gallery_model.objects.create(
                **{fk_name: media},
                image_url=_img(backdrop.get("file_path"), "w1280"),
                order=index,
            )

    def fetch_downloads_for(self, media, media_type):
        """لینک‌های دانلود یک اثر از سایت دوم (تنظیمات ایجنت) گرفته و وصل می‌شود."""
        base_url = (getattr(self.config, "download_source_url", "") or "").strip()
        if not base_url:
            return {"pages": 0, "found": 0, "created": 0, "error": "آدرس سایت دوم در تنظیمات ایجنت وارد نشده است."}
        return download_source.scrape_downloads(
            base_url,
            media,
            media_type,
            imdb_id=media.imdb_id or "",
            original_title=media.original_title or "",
            title=media.title or "",
            year=media.year,
        )

    # ---------------- وارد کردن یک اثر ----------------
    def import_candidate(self, run, candidate):
        # نوع دامنه («series») ذخیره می‌شود، نه نوع TMDB («tv»)
        media_type = _domain_media_type(candidate["media_type"])
        tmdb_id = candidate["tmdb_id"]
        is_movie = media_type == "movie"

        if is_movie:
            fa = self.client.movie_full_details(tmdb_id, language="fa-IR")
            en = self.client.movie_full_details(tmdb_id, language="en-US")
        else:
            fa = self.client.tv_full_details(tmdb_id, language="fa-IR")
            en = self.client.tv_full_details(tmdb_id, language="en-US")

        imdb_id = ((fa.get("external_ids") or {}).get("imdb_id") or "").strip()
        if not imdb_id:
            raise ValueError("شناسه‌ی IMDb در TMDB ندارد؛ رد شد.")

        # تکراری با imdb هم ممکن است (tmdb قبلاً نبوده ولی imdb هست)؛
        # این «خطا» نیست و در آمار اجرا جزو تکراری‌ها شمرده می‌شود.
        model = Movie if is_movie else Series
        if model.objects.filter(imdb_id=imdb_id).exists():
            raise AlreadyExists("با این IMDb قبلاً در سایت هست.")

        title_field = "title" if is_movie else "name"
        original_field = "original_title" if is_movie else "original_name"
        title = self._maybe_translate(fa, en, title_field, is_title=True)
        description = self._maybe_translate(fa, en, "overview")
        # قرارداد داده: title = نام فارسی، original_title = نام انگلیسی اثر.
        # فیلد original_title/original_name در TMDB نامِ زبان اصلی فیلم است
        # (مثلاً کره‌ای) و نباید در original_title ذخیره شود.
        original_title = en.get(title_field) or en.get(original_field) or fa.get(original_field) or title

        genres = self._get_or_create_genres(fa.get("genres") or en.get("genres"))
        rating = round(float(fa.get("vote_average") or candidate["vote_average"]), 1) or None
        votes = fa.get("vote_count") or candidate["vote_count"] or 0
        countries = fa.get("production_countries") or []
        country = countries[0].get("name", "") if countries else ""

        release_date = _parse_date(fa.get("release_date"))
        first_air = _parse_date(fa.get("first_air_date"))

        # بازه‌ی تاریخ اکران در خود ایمپورت هم چک می‌شود (برای کاندیداهایی
        # که تاریخشان در مرحله‌ی کشف معلوم نبود، مثل منبع سفارشی با IMDb)
        if not self._release_in_range(release_date if is_movie else first_air):
            raise OutOfRange("تاریخ اکران خارج از بازه‌ی انتخاب‌شده در تنظیمات است.")

        with transaction.atomic():
            if is_movie:
                media = Movie.objects.create(
                    title=title or original_title,
                    original_title=original_title,
                    description=description,
                    release_date=release_date,
                    runtime=fa.get("runtime") or 0,
                    imdb_id=imdb_id,
                    tmdb_id=tmdb_id,
                    imdb_rating=rating,
                    imdb_votes=votes,
                    poster_url=_img(en.get("poster_path") or fa.get("poster_path"), "w500"),
                    backdrop_url=_img(en.get("backdrop_path") or fa.get("backdrop_path"), "w1280"),
                    country=country,
                    is_active=False,  # پیش‌نویس؛ با تأیید ادمین منتشر می‌شود
                )
            else:
                media = Series.objects.create(
                    title=title or original_title,
                    original_title=original_title,
                    description=description,
                    start_date=first_air,
                    end_date=_parse_date(fa.get("last_air_date")),
                    imdb_id=imdb_id,
                    tmdb_id=tmdb_id,
                    imdb_rating=rating,
                    imdb_votes=votes,
                    poster_url=_img(en.get("poster_path") or fa.get("poster_path"), "w500"),
                    backdrop_url=_img(en.get("backdrop_path") or fa.get("backdrop_path"), "w1280"),
                    number_of_seasons=fa.get("number_of_seasons"),
                    number_of_episodes=fa.get("number_of_episodes"),
                    is_ended=fa.get("status") == "Ended",
                    is_active=False,
                )

            if genres:
                media.genres.set(genres)

            credits = fa.get("credits") or {}
            cast_model = MovieCast if is_movie else SeriesCast
            fk_name = "movie" if is_movie else "series"
            for member in (credits.get("cast") or [])[:MAX_CAST]:
                if not member.get("id"):
                    continue
                person = self._get_or_create_person(member)
                # خود اثر باید جزو lookup باشد؛ وگرنه اگر بازیگر در اثر دیگری
                # ردیف داشت، برای این اثر هیچ ردیفی ساخته نمی‌شد.
                cast_model.objects.get_or_create(
                    **{fk_name: media},
                    person=person,
                    role="actor",
                    defaults={"character_name": member.get("character") or ""},
                )
            for member in credits.get("crew") or []:
                if member.get("job") == "Director" and member.get("id"):
                    person = self._get_or_create_person(member)
                    cast_model.objects.get_or_create(
                        **{fk_name: media},
                        person=person,
                        role="director",
                        defaults={"character_name": ""},
                    )

            if not is_movie:
                self._import_series_structure(media, tmdb_id, fa, en)
            self._import_gallery(media, is_movie, fa, en)

            item = AgentImportedItem.objects.create(
                run=run,
                media_type=media_type,
                tmdb_id=tmdb_id,
                imdb_id=imdb_id,
                object_id=media.id,
                title=media.title,
                original_title=original_title,
                year=(media.year if hasattr(media, "year") else None),
                rating=rating,
                poster_url=media.poster_url,
            )

        # لینک‌های دانلود از سایت دوم — بیرون تراکنش (شبکه) و بدون اینکه
        # خرابی‌اش واردکردن اثر را از بین ببرد.
        item.auto_removed = False
        download_enabled = bool(
            getattr(self.config, "fetch_downloads", True)
            and (getattr(self.config, "download_source_url", "") or "").strip()
        )
        if download_enabled:
            summary = None
            try:
                summary = self.fetch_downloads_for(media, media_type)
            except Exception:
                # خطای شبکه یعنی «نامشخص»؛ در این حالت اثر پیش‌نویس می‌ماند
                # تا دستی بررسی شود و اشتباهاً حذف نمی‌شود.
                logger.warning("download fetch failed for %s/%s", media_type, tmdb_id, exc_info=True)
            if summary is not None:
                if summary.get("found"):
                    # لینک دانلود دارد: مستقیم در سایت منتشر می‌شود، بدون
                    # نیاز به تأیید دستی.
                    media.is_active = True
                    media.save(update_fields=["is_active"])
                    item.status = AgentImportedItem.STATUS_APPROVED
                    item.save(update_fields=["status"])
                    logger.info(
                        "downloads attached & published: %s/%s found=%s created=%s",
                        media_type, tmdb_id, summary["found"], summary["created"],
                    )
                else:
                    # لینک دانلود ندارد: خود اثر حذف می‌شود و فقط سابقه‌اش
                    # می‌ماند تا ایجنت دوباره سراغش نرود.
                    media.delete()
                    item.status = AgentImportedItem.STATUS_REJECTED
                    item.object_id = None
                    item.save(update_fields=["status", "object_id"])
                    item.auto_removed = True
                    logger.info("no downloads, auto-removed: %s/%s", media_type, tmdb_id)
        return item

    # ---------------- اجرای کامل ----------------
    def run(self, triggered_by=None, trigger_type=AgentRun.TRIGGER_MANUAL,
            sources=None, max_items=None, media_types=None):
        """اجرای همزمان (cron و تست). اجرای پنل از run_async استفاده می‌کند."""
        run = self._create_run(triggered_by, trigger_type, sources)
        self._execute(run, max_items, media_types)
        return run

    def run_async(self, triggered_by=None, sources=None, max_items=None, media_types=None):
        """اجرای پس‌زمینه برای پنل: درخواست HTTP منتظر پایان کار نمی‌ماند و
        پنل از روی وضعیت run پیشرفت را می‌بیند."""
        import threading

        run = self._create_run(triggered_by, AgentRun.TRIGGER_MANUAL, sources)

        def _target():
            try:
                self._execute(run, max_items, media_types)
            finally:
                from django.db import connection

                connection.close()

        threading.Thread(target=_target, daemon=True, name=f"content-agent-{run.id}").start()
        return run

    def _create_run(self, triggered_by, trigger_type, sources):
        return AgentRun.objects.create(
            triggered_by=triggered_by,
            trigger_type=trigger_type,
            sources=sources or self.config.sources or ["trending", "popular"],
            status=AgentRun.STATUS_RUNNING,
        )

    def _execute(self, run, max_items=None, media_types=None):
        sources = run.sources or ["trending", "popular"]
        limit = max_items or self.config.max_items_per_run
        try:
            # کشف جریانی است: تا وقتی به سقف نرسیده‌ایم صفحه‌های عمیق‌تر
            # TMDB خوانده می‌شوند، نه اینکه از اول فقط چند صفحه ببینیم.
            created = 0
            for candidate in self.discover_iter(sources, media_types=media_types):
                if created >= limit:
                    break
                run.found_count += 1
                media_type = _domain_media_type(candidate["media_type"])
                tmdb_id = candidate["tmdb_id"]
                if self._blacklisted(media_type, tmdb_id):
                    run.blacklisted_skipped += 1
                elif self._already_have(media_type, tmdb_id):
                    run.existing_skipped += 1
                else:
                    try:
                        item = self.import_candidate(run, candidate)
                        if getattr(item, "auto_removed", False):
                            # بدون لینک دانلود بود و خودکار حذف شد؛ جزو
                            # «ساخته‌شده‌ها» حساب نمی‌شود تا سقف پر نشود.
                            run.auto_removed_count += 1
                        else:
                            created += 1
                            if media_type == "movie":
                                run.created_movies += 1
                            else:
                                run.created_series += 1
                    except (AlreadyExists, OutOfRange):
                        # از قبل داریم / خارج از بازه‌ی تاریخ؛ خطا نیست
                        run.existing_skipped += 1
                    except Exception as exc:  # هر اثر مستقل است؛ خطا جلوی بقیه را نمی‌گیرد
                        run.failed_count += 1
                        errors = list(run.errors)
                        errors.append({"media_type": media_type, "tmdb_id": tmdb_id, "error": str(exc)[:300]})
                        run.errors = errors
                        logger.warning("Agent import failed %s/%s", media_type, tmdb_id, exc_info=True)
                # پیشرفت زنده ذخیره می‌شود تا پنل وضعیت واقعی را ببیند
                run.save()
            run.status = AgentRun.STATUS_SUCCESS
        except Exception as exc:
            run.status = AgentRun.STATUS_FAILED
            run.errors = [{"error": str(exc)[:500]}]
            logger.exception("Agent run failed")
        finally:
            run.finished_at = timezone.now()
            run.save()
        return run
