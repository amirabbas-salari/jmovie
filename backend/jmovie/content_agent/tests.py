from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from movies.models import Movie
from series.models import Series

from .models import AgentImportedItem, AgentRun, AgentSettings
from .services import ContentAgent

User = get_user_model()

MOVIE_DETAILS = {
    "id": 999001,
    "title": "تست فیلم",
    "original_title": "Test Movie",
    "overview": "خلاصه فارسی فیلم تستی برای ایجنت.",
    "release_date": "2024-05-01",
    "runtime": 120,
    "vote_average": 8.4,
    "vote_count": 1500,
    "poster_path": "/p.jpg",
    "backdrop_path": "/b.jpg",
    "external_ids": {"imdb_id": "tt9990001"},
    "production_countries": [{"name": "United States"}],
    "genres": [{"id": 18, "name": "درام"}],
    "credits": {
        "cast": [
            {"id": 501, "name": "Actor One", "character": "Hero", "profile_path": "/a.jpg"},
        ],
        "crew": [
            {"id": 502, "name": "Director One", "job": "Director", "profile_path": "/d.jpg"},
        ],
    },
}


class FakeTMDBClient:
    """جایگزین TMDB واقعی در تست: یک فیلم و یک سریال تکراری + موجود."""

    LIST = [
        {"id": 999001, "vote_average": 8.4, "vote_count": 1500},   # فیلم جدید
        {"id": 999002, "vote_average": 7.9, "vote_count": 900},    # از قبل داریم
        {"id": 999003, "vote_average": 3.0, "vote_count": 10},     # امتیاز کم → رد در کشف
    ]

    def _get(self, endpoint, params=None):
        if endpoint.startswith("trending/movie"):
            return {"results": self.LIST}
        if endpoint == "search/multi":
            if "test movie" in (params or {}).get("query", ""):
                return {"results": [
                    {"media_type": "movie", "id": 999001,
                     "vote_average": 8.4, "vote_count": 1500},
                ]}
            return {"results": []}
        return {"results": []}

    def movie_full_details(self, tmdb_id, language="fa-IR"):
        data = dict(MOVIE_DETAILS)
        data["id"] = tmdb_id
        return data

    def tv_full_details(self, tmdb_id, language="fa-IR"):
        return {}


class ContentAgentTest(TestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()  # لیست عمومی فیلم‌ها cache_page دارد؛ بین تست‌ها پاک شود
        AgentSettings.load()
        # فیلمی که «از قبل داریم» با همان tmdb_id لیست
        Movie.objects.create(
            title="موجود", original_title="Existing", imdb_id="tt9990002",
            tmdb_id=999002, runtime=90,
        )

    @patch("content_agent.services.TMDBClient", FakeTMDBClient)
    def test_run_creates_draft_and_skips_existing_and_low_rated(self):
        run = ContentAgent().run(sources=["trending"], max_items=10)

        self.assertEqual(run.status, AgentRun.STATUS_SUCCESS)
        self.assertEqual(run.created_movies, 1)
        self.assertEqual(run.existing_skipped, 1)

        draft = Movie.objects.get(tmdb_id=999001)
        self.assertFalse(draft.is_active)  # پیش‌نویس است، عمومی نیست
        self.assertEqual(draft.title, "تست فیلم")
        self.assertEqual(draft.genres.count(), 1)
        self.assertEqual(draft.movie_cast.count(), 2)  # بازیگر + کارگردان

        item = AgentImportedItem.objects.get(tmdb_id=999001)
        self.assertEqual(item.status, AgentImportedItem.STATUS_PENDING)

        # در API عمومی دیده نمی‌شود
        res = APIClient().get("/movies/")
        ids = [m["id"] for m in res.data["results"]]
        self.assertNotIn(draft.id, ids)

    @patch("content_agent.services.TMDBClient", FakeTMDBClient)
    def test_second_run_does_not_duplicate(self):
        ContentAgent().run(sources=["trending"], max_items=10)
        run2 = ContentAgent().run(sources=["trending"], max_items=10)
        self.assertEqual(run2.created_movies, 0)
        self.assertEqual(Movie.objects.filter(tmdb_id=999001).count(), 1)

    @patch("content_agent.services.TMDBClient", FakeTMDBClient)
    def test_approve_publishes_and_reject_blacklists(self):
        ContentAgent().run(sources=["trending"], max_items=10)
        item = AgentImportedItem.objects.get(tmdb_id=999001)
        client = APIClient()
        admin = User.objects.create_user(
            username="boss", password="Str0ng!Pass123",
            is_staff=True, is_superuser=True,
        )
        client.force_authenticate(admin)

        res = client.post(f"/agent/drafts/{item.id}/approve/")
        self.assertEqual(res.status_code, 200)
        draft = Movie.objects.get(tmdb_id=999001)
        self.assertTrue(draft.is_active)
        # حالا عمومی دیده می‌شود
        ids = [m["id"] for m in APIClient().get("/movies/").data["results"]]
        self.assertIn(draft.id, ids)

        client.post(f"/agent/drafts/{item.id}/reject/")
        self.assertFalse(Movie.objects.get(tmdb_id=999001).is_active)

        # اجرای بعدی نباید دوباره بیاورد (لیست سیاه)
        run = ContentAgent().run(sources=["trending"], max_items=10)
        self.assertEqual(run.created_movies, 0)
        self.assertGreaterEqual(run.blacklisted_skipped, 1)

    def test_agent_endpoints_require_staff(self):
        client = APIClient()
        self.assertEqual(client.get("/agent/drafts/").status_code, 401)
        user = User.objects.create_user(username="u1", password="Str0ng!Pass123")
        client.force_authenticate(user)
        self.assertEqual(client.get("/agent/drafts/").status_code, 403)


SITEMAP_XML = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/movie/test-movie-2024/</loc></url>
  <url><loc>https://example.com/movie/existing-film/</loc></url>
</urlset>
"""


class FakeResponse:
    def __init__(self, text):
        self.text = text

    def raise_for_status(self):
        pass


class CustomSourceTest(TestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        settings_obj = AgentSettings.load()
        settings_obj.discovery_source_url = "https://example.com/sitemap.xml"
        settings_obj.translate_with_ai = False
        settings_obj.save()

    @patch("content_agent.services.TMDBClient", FakeTMDBClient)
    @patch("requests.get", return_value=FakeResponse(SITEMAP_XML))
    def test_discovers_titles_from_custom_sitemap(self, _mock_get):
        agent = ContentAgent()
        candidates = agent.discover_from_custom_source(limit=10)
        keys = {(c["media_type"], c["tmdb_id"]) for c in candidates}
        self.assertIn(("movie", 999001), keys)

    @patch("content_agent.services.TMDBClient", FakeTMDBClient)
    @patch("requests.get", return_value=FakeResponse(SITEMAP_XML))
    def test_run_with_custom_source_imports_draft(self, _mock_get):
        run = ContentAgent().run(sources=["custom"], max_items=5)
        self.assertEqual(run.created_movies, 1)
        self.assertFalse(Movie.objects.get(tmdb_id=999001).is_active)


# ---------------------------------------------------------------------------
# تست‌های اصلاحات ایجنت: بازیگر مشترک، slug ژانر فارسی، فصل/قسمت، دانلود
# ---------------------------------------------------------------------------
from django.contrib.contenttypes.models import ContentType

from downloads.models import Download
from movies.models import MovieCast
from series.models import Episode, Season

SERIES_DETAILS = {
    "id": 999101,
    "name": "سریال تست",
    "original_name": "Test Show",
    "overview": "خلاصه فارسی سریال تستی.",
    "first_air_date": "2023-03-01",
    "last_air_date": "2024-01-01",
    "status": "Ended",
    "number_of_seasons": 1,
    "number_of_episodes": 2,
    "vote_average": 8.9,
    "vote_count": 2200,
    "poster_path": "/sp.jpg",
    "backdrop_path": "/sb.jpg",
    "external_ids": {"imdb_id": "tt9990101"},
    "genres": [{"id": 18, "name": "درام"}, {"id": 35, "name": "کمدی"}],
    "credits": {"cast": [{"id": 601, "name": "Show Actor", "character": "Lead", "profile_path": "/sa.jpg"}], "crew": []},
    "seasons": [
        {"season_number": 0, "name": "Specials", "air_date": "2023-01-01"},
        {"season_number": 1, "name": "Season 1", "air_date": "2023-03-01"},
    ],
    "images": {"backdrops": [{"file_path": "/sg1.jpg"}, {"file_path": "/sg2.jpg"}]},
}

SEASON_1 = {
    "name": "Season 1",
    "overview": "",
    "air_date": "2023-03-01",
    "episodes": [
        {"episode_number": 1, "name": "آغاز", "overview": "قسمت اول", "runtime": 45,
         "air_date": "2023-03-01", "id": 7001, "vote_average": 8.5, "vote_count": 100, "still_path": "/e1.jpg"},
        {"episode_number": 2, "name": "ادامه", "overview": "قسمت دوم", "runtime": 47,
         "air_date": "2023-03-08", "id": 7002, "vote_average": 8.7, "vote_count": 90, "still_path": "/e2.jpg"},
    ],
}

MOVIE_DETAILS_2 = dict(MOVIE_DETAILS)
MOVIE_DETAILS_2.update({
    "id": 999010,
    "title": "فیلم دوم",
    "original_title": "Second Movie",
    "external_ids": {"imdb_id": "tt9990010"},
    "genres": [{"id": 18, "name": "درام"}, {"id": 35, "name": "کمدی"}],
    "images": {"backdrops": [{"file_path": "/g1.jpg"}]},
})


class FakeTMDBClient2(FakeTMDBClient):
    LIST2 = [
        {"id": 999001, "vote_average": 8.4, "vote_count": 1500},
        {"id": 999010, "vote_average": 8.1, "vote_count": 800},
    ]
    TV_LIST = [{"id": 999101, "vote_average": 8.9, "vote_count": 2200}]

    def _get(self, endpoint, params=None):
        if endpoint.startswith("trending/movie"):
            return {"results": self.LIST2}
        if endpoint.startswith("trending/tv"):
            return {"results": self.TV_LIST}
        if endpoint.startswith("tv/999101/season/"):
            return dict(SEASON_1)
        return {"results": []}

    def movie_full_details(self, tmdb_id, language="fa-IR"):
        data = dict(MOVIE_DETAILS_2 if tmdb_id == 999010 else MOVIE_DETAILS)
        data["id"] = tmdb_id
        if language == "en-US":
            # مثل TMDB واقعی: عنوان در پاسخ انگلیسی، نام انگلیسی است
            data["title"] = data.get("original_title") or data["title"]
        return data

    def tv_full_details(self, tmdb_id, language="fa-IR"):
        data = dict(SERIES_DETAILS)
        data["id"] = tmdb_id
        if language == "en-US":
            data["name"] = data.get("original_name") or data["name"]
        return data


class AgentFixesTest(TestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        settings_obj = AgentSettings.load()
        settings_obj.translate_with_ai = False
        settings_obj.fetch_downloads = False
        settings_obj.save()

    @patch("content_agent.services.TMDBClient", FakeTMDBClient2)
    def test_shared_actor_gets_cast_row_in_every_movie(self):
        ContentAgent().run(sources=["trending"], max_items=10)
        m1 = Movie.objects.get(tmdb_id=999001)
        m2 = Movie.objects.get(tmdb_id=999010)
        actor_rows = MovieCast.objects.filter(person__tmdb_id="501", role="actor")
        self.assertEqual(actor_rows.count(), 2)
        self.assertEqual({r.movie_id for r in actor_rows}, {m1.id, m2.id})

    @patch("content_agent.services.TMDBClient", FakeTMDBClient2)
    def test_persian_genre_names_get_unique_nonempty_slugs(self):
        ContentAgent().run(sources=["trending"], max_items=10)
        from genres.models import Genre

        slugs = list(Genre.objects.filter(tmdb_id__in=[18, 35]).values_list("slug", flat=True))
        self.assertEqual(len(slugs), 2)
        self.assertTrue(all(slugs))
        self.assertEqual(len(set(slugs)), 2)

    @patch("content_agent.services.TMDBClient", FakeTMDBClient2)
    def test_series_import_creates_seasons_and_episodes(self):
        run = ContentAgent().run(sources=["trending"], max_items=10)
        self.assertEqual(run.created_series, 1)
        show = Series.objects.get(tmdb_id=999101)
        self.assertFalse(show.is_active)
        # فصل صفر (ویژه‌ها) وارد نمی‌شود
        self.assertEqual(Season.objects.filter(series=show).count(), 1)
        season = Season.objects.get(series=show, season_number=1)
        self.assertEqual(Episode.objects.filter(season=season).count(), 2)
        ep = Episode.objects.get(season=season, episode_number=2)
        self.assertEqual(ep.title, "ادامه")
        self.assertEqual(ep.tmdb_id, 7002)
        self.assertTrue(ep.still_image_url)
        # بازیگر سریال و گالری هم آمده‌اند
        self.assertEqual(show.cast.count(), 1)
        self.assertEqual(show.gallery.count(), 2)

    @patch("content_agent.services.TMDBClient", FakeTMDBClient2)
    def test_imdb_duplicate_counts_as_existing_not_failure(self):
        Movie.objects.create(
            title="موجود با IMDb", original_title="Dup", imdb_id="tt9990010",
            tmdb_id=555000, runtime=90,
        )
        run = ContentAgent().run(sources=["trending"], max_items=10)
        self.assertEqual(run.failed_count, 0)
        self.assertGreaterEqual(run.existing_skipped, 1)
        self.assertEqual(Movie.objects.filter(imdb_id="tt9990010").count(), 1)


SEARCH_HTML = """<html><body>
<a href="https://dl.example.com/movie/test-movie-2024/">Test Movie دانلود فیلم</a>
<a href="https://dl.example.com/movie/second-movie/">Second Movie دانلود فیلم</a>
<a href="https://dl.example.com/show/test-show/">Test Show سریال</a>
</body></html>"""
MOVIE_PAGE_HTML = """<html><body>
<a href="https://dl.example.com/files/Test.Movie.2024.1080p.BluRay.mkv">دانلود کیفیت 1080p BluRay حجم 2.1 GB زیرنویس فارسی</a>
<a href="https://dl.example.com/files/Test.Movie.2024.720p.WEB-DL.mkv">دانلود 720p حجم 900 MB دوبله فارسی</a>
<a href="https://t.me/share/url?url=x">اشتراک تلگرام</a>
</body></html>"""
SERIES_PAGE_HTML = """<html><body>
<a href="https://dl.example.com/files/Test.Show.S01E01.720p.mkv">قسمت 1 فصل 1 کیفیت 720p حجم 700 MB</a>
<a href="https://dl.example.com/files/Test.Show.S01E02.1080p.mkv">S01E02 کیفیت 1080p</a>
</body></html>"""


def _fake_fetch_html(_session, url):
    if "s=" in url or "/search/" in url:
        return SEARCH_HTML, url
    if "test-show" in url:
        return SERIES_PAGE_HTML, url
    return MOVIE_PAGE_HTML, url


class DownloadSourceTest(TestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        settings_obj = AgentSettings.load()
        settings_obj.translate_with_ai = False
        settings_obj.fetch_downloads = True
        settings_obj.download_source_url = "https://dl.example.com"
        settings_obj.save()

    @patch("content_agent.services.TMDBClient", FakeTMDBClient2)
    @patch("content_agent.download_source.fetch_html", side_effect=_fake_fetch_html)
    def test_auto_downloads_attached_to_movie_with_metadata(self, _fetch):
        ContentAgent().run(sources=["trending"], max_items=1)
        movie = Movie.objects.get(tmdb_id=999001)
        ct = ContentType.objects.get_for_model(Movie)
        downloads = Download.objects.filter(content_type=ct, object_id=movie.id)
        self.assertEqual(downloads.count(), 2)
        by_quality = {d.quality: d for d in downloads}
        self.assertIn("1080p", " ".join(by_quality.keys()))
        hd = next(d for d in downloads if "1080p" in d.quality)
        self.assertEqual(hd.size, "2.1 GB")
        self.assertTrue(hd.subtitle)
        dubbed = next(d for d in downloads if "720p" in d.quality)
        self.assertEqual(dubbed.language, "دوبله فارسی")

    @patch("content_agent.services.TMDBClient", FakeTMDBClient2)
    @patch("content_agent.download_source.fetch_html", side_effect=_fake_fetch_html)
    def test_series_links_attach_to_correct_episodes(self, _fetch):
        ContentAgent().run(sources=["trending"], max_items=10)
        show = Series.objects.get(tmdb_id=999101)
        ep1 = Episode.objects.get(season__series=show, episode_number=1)
        ep2 = Episode.objects.get(season__series=show, episode_number=2)
        ct = ContentType.objects.get_for_model(Episode)
        self.assertEqual(Download.objects.filter(content_type=ct, object_id=ep1.id).count(), 1)
        self.assertEqual(Download.objects.filter(content_type=ct, object_id=ep2.id).count(), 1)

    @patch("content_agent.services.TMDBClient", FakeTMDBClient2)
    @patch("content_agent.download_source.fetch_html", side_effect=_fake_fetch_html)
    def test_fetch_downloads_endpoint_and_missing_media_guard(self, _fetch):
        settings_obj = AgentSettings.load()
        settings_obj.fetch_downloads = False
        settings_obj.save()
        ContentAgent().run(sources=["trending"], max_items=1)
        item = AgentImportedItem.objects.get(tmdb_id=999001)
        movie = Movie.objects.get(tmdb_id=999001)
        ct = ContentType.objects.get_for_model(Movie)
        self.assertEqual(Download.objects.filter(content_type=ct, object_id=movie.id).count(), 0)

        admin = User.objects.create_user(
            username="boss2", password="Str0ng!Pass123", is_staff=True, is_superuser=True
        )
        client = APIClient()
        client.force_authenticate(admin)
        res = client.post(f"/agent/drafts/{item.id}/fetch-downloads/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["summary"]["created"], 2)
        self.assertEqual(res.data["item"]["downloads_count"], 2)
        # تلاش دوباره تکراری نمی‌سازد
        res2 = client.post(f"/agent/drafts/{item.id}/fetch-downloads/")
        self.assertEqual(res2.data["summary"]["created"], 0)

        # تأیید پیش‌نویسی که اثرش حذف شده باید خطای روشن بدهد
        movie.delete()
        res3 = client.post(f"/agent/drafts/{item.id}/approve/")
        self.assertEqual(res3.status_code, 400)


# ---------------------------------------------------------------------------
# قرارداد داده (title فارسی / original_title انگلیسی / پوستر انگلیسی)
# و جستجوی مقاوم‌تر در سایت دوم
# ---------------------------------------------------------------------------
class FakeTMDBClientLang(FakeTMDBClient2):
    """پاسخ TMDB به زبان فرق می‌کند و نام زبان اصلی اثر کره‌ای است."""

    def movie_full_details(self, tmdb_id, language="fa-IR"):
        base = {
            "id": tmdb_id, "original_title": "원제목",
            "release_date": "2024-01-01", "runtime": 100,
            "vote_average": 8.0, "vote_count": 500,
            "external_ids": {"imdb_id": "tt9990010"},
            "genres": [], "credits": {"cast": [], "crew": []},
            "images": {"backdrops": []},
        }
        if language == "en-US":
            base.update({
                "title": "English Movie Name", "overview": "English overview",
                "poster_path": "/en-poster.jpg", "backdrop_path": "/en-bg.jpg",
            })
        else:
            base.update({
                "title": "نام فارسی فیلم", "overview": "خلاصه فارسی",
                "poster_path": "/fa-poster.jpg", "backdrop_path": "/fa-bg.jpg",
            })
        return base

    def tv_full_details(self, tmdb_id, language="fa-IR"):
        data = dict(SERIES_DETAILS)
        data["id"] = tmdb_id
        if language == "en-US":
            data.update({
                "name": "English Show Name", "original_name": "원제",
                "poster_path": "/en-sp.jpg", "backdrop_path": "/en-sbg.jpg",
            })
        else:
            data.update({
                "name": "سریال فارسی", "original_name": "원제",
                "poster_path": "/fa-sp.jpg", "backdrop_path": "/fa-sbg.jpg",
            })
        return data


class DataContractTest(TestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        settings_obj = AgentSettings.load()
        settings_obj.translate_with_ai = False
        settings_obj.fetch_downloads = False
        settings_obj.save()

    @patch("content_agent.services.TMDBClient", FakeTMDBClientLang)
    def test_title_persian_original_english_poster_english(self):
        ContentAgent().run(sources=["trending"], max_items=10)
        movie = Movie.objects.get(tmdb_id=999001)
        self.assertEqual(movie.title, "نام فارسی فیلم")
        self.assertEqual(movie.original_title, "English Movie Name")
        self.assertTrue(movie.poster_url.endswith("/en-poster.jpg"))
        self.assertTrue(movie.backdrop_url.endswith("/en-bg.jpg"))

        show = Series.objects.get(tmdb_id=999101)
        self.assertEqual(show.title, "سریال فارسی")
        self.assertEqual(show.original_title, "English Show Name")
        self.assertTrue(show.poster_url.endswith("/en-sp.jpg"))


PERSIAN_SEARCH_HTML = """<html><body>
<a href="https://dl.example.com/m/12345/">دانلود فیلم نام فارسی فیلم با کیفیت عالی</a>
<a href="https://dl.example.com/about/">درباره ما</a>
</body></html>"""


def _fake_fetch_persian(_session, url):
    if "s=" in url or "/search" in url:
        return PERSIAN_SEARCH_HTML, url
    return "<html><body></body></html>", url


class DownloadFinderTest(TestCase):
    def test_persian_title_tokens_find_the_page(self):
        from content_agent import download_source

        with patch("content_agent.download_source.fetch_html", side_effect=_fake_fetch_persian):
            pages = download_source.find_title_pages(
                object(), "https://dl.example.com",
                imdb_id="", original_title="Completely Different Words",
                title="نام فارسی فیلم", year=2024,
            )
        self.assertEqual(pages, ["https://dl.example.com/m/12345/"])

    def test_session_uses_browser_user_agent(self):
        from content_agent import download_source

        ua = download_source._session().headers.get("User-Agent", "")
        self.assertIn("Mozilla", ua)

    @patch("content_agent.download_source.fetch_html")
    def test_follow_download_page_then_attach_and_reason(self, mock_fetch):
        def fake(_session, url):
            if "s=" in url or "/search" in url:
                return (
                    '<html><body><a href="https://dl.example.com/movie/english-movie-name/">English Movie Name دانلود</a></body></html>',
                    url,
                )
            if url.rstrip("/").endswith("english-movie-name"):
                return (
                    '<html><body><a href="https://dl.example.com/dl/english-movie-name/">دانلود فیلم</a></body></html>',
                    url,
                )
            return (
                '<html><body><a href="https://dl.example.com/files/English.Movie.2024.1080p.mkv">دانلود 1080p حجم 2 GB زیرنویس</a></body></html>',
                url,
            )

        mock_fetch.side_effect = fake
        settings_obj = AgentSettings.load()
        settings_obj.download_source_url = "https://dl.example.com"
        settings_obj.save()
        movie = Movie.objects.create(
            title="نام فارسی فیلم", original_title="English Movie Name",
            imdb_id="tt1234567", tmdb_id=424242, runtime=100, year=2024,
        )
        summary = ContentAgent().fetch_downloads_for(movie, "movie")
        self.assertEqual(summary["found"], 1)
        self.assertEqual(summary["created"], 1)
        ct = ContentType.objects.get_for_model(Movie)
        self.assertEqual(Download.objects.filter(content_type=ct, object_id=movie.id).count(), 1)

        # هیچ نتیجه‌ای -> دلیل خالی‌نبودن هم برمی‌گردد
        mock_fetch.side_effect = lambda _s, url: ("<html><body>بدون نتیجه</body></html>", url)
        movie2 = Movie.objects.create(
            title="اثر دیگر", original_title="Nothing Here",
            imdb_id="tt7654321", tmdb_id=434343, runtime=90,
        )
        summary2 = ContentAgent().fetch_downloads_for(movie2, "movie")
        self.assertEqual(summary2["found"], 0)
        self.assertTrue(summary2.get("reason"))


# ---------------------------------------------------------------------------
# استخراج متادیتای لینک دانلود: کیفیت، زیرنویس، دوبله، حجم، فصل/قسمت
# ---------------------------------------------------------------------------
class DownloadMetadataTest(TestCase):
    BASE = "https://dl.example.com/movie/x/"

    def extract(self, html):
        from content_agent import download_source

        return download_source.extract_download_links(html, self.BASE)

    def test_quality_label_before_anchor_and_no_cross_bleed(self):
        html = """<html><body>
        <div><span>کیفیت 720p</span><a href="https://dl.example.com/files/f1.mkv">دانلود</a></div>
        <div><span>کیفیت 1080p BluRay</span><a href="https://dl.example.com/files/f2.mkv">دانلود</a></div>
        </body></html>"""
        links = self.extract(html)
        self.assertEqual([l["quality"] for l in links], ["720p", "1080p BluRay"])

    def test_url_filename_wins_for_quality_and_dubbed(self):
        html = (
            '<a href="https://dl.example.com/files/Movie.2024.720p.WEB-DL.x265.Dubbed.mkv">'
            "دانلود با لینک مستقیم</a><span>نسخه 1080p هم موجود است</span>"
        )
        links = self.extract(html)
        self.assertEqual(len(links), 1)
        self.assertEqual(links[0]["quality"], "720p WEB-DL x265")
        self.assertEqual(links[0]["language"], "دوبله فارسی")

    def test_subtitle_contract_and_negation(self):
        html = """<html><body>
        <a href="https://dl.example.com/files/a.1080p.mkv">دانلود زیرنویس فارسی چسبیده</a>
        <a href="https://dl.example.com/files/b.720p.mkv">دانلود بدون زیرنویس</a>
        </body></html>"""
        links = self.extract(html)
        # قرارداد نمایش کارت دانلود: زیرنویس‌دار = زبان اصلی + subtitle
        self.assertEqual(links[0]["language"], "original")
        self.assertTrue(links[0]["subtitle"])
        self.assertEqual(links[1]["language"], "original")
        self.assertFalse(links[1]["subtitle"])

    def test_persian_size_and_season_episode(self):
        html = '<a href="https://dl.example.com/files/show.mkv">دانلود فصل ۲ قسمت ۵ کیفیت 720p حجم ۱٫۴ گیگابایت</a>'
        link = self.extract(html)[0]
        self.assertEqual((link["season"], link["episode"]), (2, 5))
        self.assertTrue(link["size"].startswith("1.4"))

    def test_attach_updates_metadata_on_refetch(self):
        from content_agent import download_source

        movie = Movie.objects.create(
            title="فیلم", original_title="M", imdb_id="tt0001",
            tmdb_id=11, runtime=90,
        )
        ct = ContentType.objects.get_for_model(Movie)
        Download.objects.create(
            content_type=ct, object_id=movie.id,
            url="https://dl.example.com/f.mkv",
            quality="نامشخص", language="زیرنویس فارسی", subtitle=False,
        )
        created = download_source.attach_downloads(movie, "movie", [{
            "url": "https://dl.example.com/f.mkv", "title": "",
            "quality": "1080p BluRay", "size": "2 GB",
            "language": "original", "subtitle": True,
            "season": None, "episode": None,
        }])
        self.assertEqual(created, 0)
        saved = Download.objects.get(content_type=ct, object_id=movie.id)
        self.assertEqual(saved.quality, "1080p BluRay")
        self.assertEqual(saved.language, "original")
        self.assertTrue(saved.subtitle)


# ---------------------------------------------------------------------------
# فیلتر نوع اثر: فقط فیلم / فقط سریال
# ---------------------------------------------------------------------------
class MediaTypeFilterTest(TestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        settings_obj = AgentSettings.load()
        settings_obj.translate_with_ai = False
        settings_obj.fetch_downloads = False
        settings_obj.media_types = []
        settings_obj.save()

    def _set_types(self, types):
        settings_obj = AgentSettings.load()
        settings_obj.media_types = types
        settings_obj.save()

    @patch("content_agent.services.TMDBClient", FakeTMDBClient2)
    def test_series_only_filter(self):
        self._set_types(["series"])
        run = ContentAgent().run(sources=["trending"], max_items=10)
        self.assertEqual(run.created_series, 1)
        self.assertEqual(run.created_movies, 0)
        self.assertEqual(Movie.objects.count(), 0)
        # پیش‌نویس سریال با نوع دامنه ذخیره می‌شود، نه «tv» خام TMDB
        item = AgentImportedItem.objects.get(tmdb_id=999101)
        self.assertEqual(item.media_type, "series")

    @patch("content_agent.services.TMDBClient", FakeTMDBClient2)
    def test_movie_only_filter(self):
        self._set_types(["movie"])
        run = ContentAgent().run(sources=["trending"], max_items=10)
        self.assertEqual(run.created_movies, 2)
        self.assertEqual(run.created_series, 0)
        self.assertEqual(Series.objects.count(), 0)

    @patch("content_agent.services.TMDBClient", FakeTMDBClient2)
    def test_empty_means_both_and_per_run_override(self):
        # override روی خود اجرا، بدون دست‌زدن به تنظیمات ذخیره‌شده
        run = ContentAgent().run(sources=["trending"], max_items=10, media_types=["movie"])
        self.assertEqual(run.created_movies, 2)
        self.assertEqual(run.created_series, 0)
        # بدون فیلتر (تنظیمات خالی) هر دو نوع می‌آیند
        run2 = ContentAgent().run(sources=["trending"], max_items=10)
        self.assertEqual(run2.created_series, 1)

    def test_settings_api_roundtrip_and_validation(self):
        admin = User.objects.create_user(
            username="boss3", password="Str0ng!Pass123", is_staff=True, is_superuser=True
        )
        client = APIClient()
        client.force_authenticate(admin)
        res = client.patch("/agent/settings/", {"media_types": ["series"]}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["media_types"], ["series"])
        res = client.get("/agent/settings/")
        self.assertEqual(res.data["media_types"], ["series"])
        # مقادیر نامعتبر از فهرست حذف می‌شوند
        res = client.patch("/agent/settings/", {"media_types": ["movie", "book"]}, format="json")
        self.assertEqual(res.data["media_types"], ["movie"])


# ---------------------------------------------------------------------------
# کشف عمیق (صفحه‌های بعدی TMDB)، انتشار/حذف خودکار بر اساس لینک دانلود،
# بازه‌ی تاریخ اکران
# ---------------------------------------------------------------------------
from datetime import date as _date


class FakeTMDBClientPaged(FakeTMDBClient):
    PAGES = {1: [11, 12], 2: [13, 14], 3: [15, 16]}

    def _get(self, endpoint, params=None):
        if endpoint.startswith("trending/movie"):
            page = (params or {}).get("page", 1)
            ids = self.PAGES.get(page, [])
            return {"results": [{"id": i, "vote_average": 9, "vote_count": 900} for i in ids]}
        return {"results": []}

    def movie_full_details(self, tmdb_id, language="fa-IR"):
        data = dict(MOVIE_DETAILS)
        data["id"] = tmdb_id
        data["external_ids"] = {"imdb_id": f"tt{tmdb_id:07d}"}
        if language == "en-US":
            data["title"] = f"Movie {tmdb_id}"
        return data


class DeepDiscoveryTest(TestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        settings_obj = AgentSettings.load()
        settings_obj.translate_with_ai = False
        settings_obj.fetch_downloads = False
        settings_obj.save()

    @patch("content_agent.services.TMDBClient", FakeTMDBClientPaged)
    def test_run_pages_deeper_until_limit_filled(self):
        for tmdb_id in (11, 12, 13, 14):
            Movie.objects.create(
                title=f"قدیمی {tmdb_id}", original_title="Old",
                imdb_id=f"tt{tmdb_id:07d}", tmdb_id=tmdb_id, runtime=90,
            )
        run = ContentAgent().run(sources=["trending"], max_items=2)
        # صفحه‌های ۱ و ۲ همه تکراری‌اند؛ سقف باید از صفحه‌ی ۳ پر شود
        self.assertEqual(run.created_movies, 2)
        self.assertEqual(Movie.objects.filter(tmdb_id__in=[15, 16]).count(), 2)
        self.assertGreaterEqual(run.existing_skipped, 4)


class FakeTMDBClientGate(FakeTMDBClient):
    ITEMS = [
        {"id": 901, "vote_average": 9, "vote_count": 900},
        {"id": 902, "vote_average": 9, "vote_count": 900},
    ]

    def _get(self, endpoint, params=None):
        if endpoint.startswith("trending/movie"):
            return {"results": [dict(i) for i in self.ITEMS]}
        return {"results": []}

    def movie_full_details(self, tmdb_id, language="fa-IR"):
        data = dict(MOVIE_DETAILS)
        data["id"] = tmdb_id
        data["external_ids"] = {"imdb_id": f"tt{tmdb_id:07d}"}
        if language == "en-US":
            data["title"] = f"Movie {tmdb_id}"
        return data


def _gate_fetch(_session, url):
    if "tt0000901" in url:
        return ('<html><body><a href="https://dl.example.com/movie/a/">Movie 901</a></body></html>', url)
    if url.rstrip("/").endswith("/movie/a"):
        return ('<html><body><a href="https://dl.example.com/files/a.1080p.mkv">دانلود 1080p</a></body></html>', url)
    return ("<html><body>بدون نتیجه</body></html>", url)


class PublishGateTest(TestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        settings_obj = AgentSettings.load()
        settings_obj.translate_with_ai = False
        settings_obj.fetch_downloads = True
        settings_obj.download_source_url = "https://dl.example.com"
        settings_obj.save()

    @patch("content_agent.services.TMDBClient", FakeTMDBClientGate)
    @patch("content_agent.download_source.fetch_html", side_effect=_gate_fetch)
    def test_publish_with_links_delete_without(self, _fetch):
        run = ContentAgent().run(sources=["trending"], max_items=10)
        self.assertEqual(run.created_movies, 1)
        self.assertEqual(run.auto_removed_count, 1)

        published = Movie.objects.get(tmdb_id=901)
        self.assertTrue(published.is_active)
        self.assertFalse(Movie.objects.filter(tmdb_id=902).exists())

        items = {i.tmdb_id: i for i in AgentImportedItem.objects.all()}
        self.assertEqual(items[901].status, AgentImportedItem.STATUS_APPROVED)
        self.assertEqual(items[902].status, AgentImportedItem.STATUS_REJECTED)
        self.assertIsNone(items[902].object_id)

        # اثر حذف‌شده در اجراهای بعدی دوباره وارد نمی‌شود
        run2 = ContentAgent().run(sources=["trending"], max_items=10)
        self.assertEqual(run2.created_movies, 0)
        self.assertGreaterEqual(run2.blacklisted_skipped, 1)


class FakeTMDBClientDates(FakeTMDBClient):
    DATES = {801: "2023-05-01", 802: "2024-05-01", 803: "2025-05-01"}

    def _get(self, endpoint, params=None):
        if endpoint.startswith("trending/movie"):
            return {"results": [
                {"id": i, "vote_average": 9, "vote_count": 900, "release_date": d}
                for i, d in self.DATES.items()
            ]}
        return {"results": []}

    def movie_full_details(self, tmdb_id, language="fa-IR"):
        data = dict(MOVIE_DETAILS)
        data["id"] = tmdb_id
        data["external_ids"] = {"imdb_id": f"tt{tmdb_id:07d}"}
        data["release_date"] = self.DATES[tmdb_id]
        if language == "en-US":
            data["title"] = f"Movie {tmdb_id}"
        return data


class ReleaseRangeTest(TestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        settings_obj = AgentSettings.load()
        settings_obj.translate_with_ai = False
        settings_obj.fetch_downloads = False
        settings_obj.save()

    @patch("content_agent.services.TMDBClient", FakeTMDBClientDates)
    def test_only_in_range_imported(self):
        settings_obj = AgentSettings.load()
        settings_obj.release_date_from = _date(2024, 1, 1)
        settings_obj.release_date_to = _date(2024, 12, 31)
        settings_obj.save()
        run = ContentAgent().run(sources=["trending"], max_items=10)
        self.assertEqual(run.created_movies, 1)
        self.assertEqual({m.tmdb_id for m in Movie.objects.all()}, {802})

        settings_obj.release_date_from = None
        settings_obj.release_date_to = None
        settings_obj.save()
        run2 = ContentAgent().run(sources=["trending"], max_items=10)
        self.assertEqual(run2.created_movies, 2)


# ---------------------------------------------------------------------------
# لینک دانلود سریال = لینک قسمت‌ها: دنبال‌کردن صفحه‌ی هر قسمت، نادیده‌گرفتن
# تریلر و وصل‌نشدن هیچ لینکی به خود آبجکت سریال
# ---------------------------------------------------------------------------
EP_SEARCH_HTML = """<html><body>
<a href="https://dl.example.com/show/test-show/">Test Show دانلود سریال</a>
</body></html>"""

EPISODE_PAGES_SERIES_HTML = """<html><body>
<a href="https://dl.example.com/files/Test.Show.Trailer.1080p.mp4">تریلر سریال</a>
<a href="https://dl.example.com/episode/test-show-ep1/">دانلود قسمت ۱</a>
<a href="https://dl.example.com/episode/test-show-ep2/">دانلود قسمت ۲</a>
</body></html>"""

EP1_PAGE_HTML = """<html><body>
<a href="https://dl.example.com/files/opaque-111.mkv">دانلود 720p حجم 700 MB زیرنویس فارسی</a>
<a href="https://dl.example.com/files/opaque-112.mkv">دانلود 1080p</a>
</body></html>"""

EP2_PAGE_HTML = """<html><body>
<a href="https://dl.example.com/files/opaque-211.mkv">دانلود 720p</a>
</body></html>"""

# لینک‌های مستقیم روی خود صفحه‌ی سریال، با شماره‌ی حروفی و ردیف‌های گروهی
ORDINAL_SERIES_HTML = """<html><body>
<h3>فصل اول</h3>
<p>قسمت اول: <a href="https://dl.example.com/files/aa1.mkv">دانلود 720p</a>
<a href="https://dl.example.com/files/aa2.mkv">دانلود 1080p</a></p>
<p>قسمت دوم: <a href="https://dl.example.com/files/bb1.mkv">دانلود 720p</a></p>
<a href="https://dl.example.com/files/Test.Show.Trailer.mp4">مشاهده تریلر</a>
</body></html>"""

NO_EPISODE_SERIES_HTML = """<html><body>
<a href="https://dl.example.com/files/show-full-1080p.mkv">دانلود سریال با کیفیت 1080p</a>
<a href="https://dl.example.com/files/show-trailer.mp4">تریلر</a>
</body></html>"""


def _fake_fetch_episode_pages(_session, url):
    if "s=" in url or "/search" in url:
        return EP_SEARCH_HTML, url
    if "test-show-ep1" in url:
        return EP1_PAGE_HTML, url
    if "test-show-ep2" in url:
        return EP2_PAGE_HTML, url
    if url.rstrip("/").endswith("test-show"):
        return EPISODE_PAGES_SERIES_HTML, url
    return "<html><body></body></html>", url


class SeriesEpisodeDownloadTest(TestCase):
    def setUp(self):
        from django.core.cache import cache

        from series.models import Episode, Season, Series

        cache.clear()
        settings_obj = AgentSettings.load()
        settings_obj.translate_with_ai = False
        settings_obj.fetch_downloads = True
        settings_obj.download_source_url = "https://dl.example.com"
        settings_obj.save()
        self.show = Series.objects.create(
            title="سریال تستی", original_title="Test Show",
            imdb_id="tt9990101", tmdb_id=999101,
        )
        season = Season.objects.create(series=self.show, season_number=1)
        self.ep1 = Episode.objects.create(season=season, episode_number=1)
        self.ep2 = Episode.objects.create(season=season, episode_number=2)

    def _downloads_of(self, obj):
        from django.contrib.contenttypes.models import ContentType

        from downloads.models import Download

        ct = ContentType.objects.get_for_model(obj.__class__)
        return Download.objects.filter(content_type=ct, object_id=obj.id)

    @patch("content_agent.download_source.fetch_html", side_effect=_fake_fetch_episode_pages)
    def test_episode_pages_followed_and_trailer_ignored(self, _fetch):
        summary = ContentAgent().fetch_downloads_for(self.show, "series")
        self.assertEqual(summary["found"], 3)
        self.assertEqual(summary["created"], 3)
        self.assertEqual(self._downloads_of(self.ep1).count(), 2)
        self.assertEqual(self._downloads_of(self.ep2).count(), 1)
        # هیچ لینکی به خود سریال وصل نشده و تریلر هیچ‌جا ذخیره نشده است
        self.assertEqual(self._downloads_of(self.show).count(), 0)
        from downloads.models import Download

        self.assertFalse(Download.objects.filter(url__icontains="trailer").exists())

    def test_grouped_ordinal_links_attach_to_episodes(self):
        from content_agent import download_source

        def fake(_session, url):
            if "s=" in url or "/search" in url:
                return EP_SEARCH_HTML, url
            return ORDINAL_SERIES_HTML, url

        with patch("content_agent.download_source.fetch_html", side_effect=fake):
            summary = ContentAgent().fetch_downloads_for(self.show, "series")
        self.assertEqual(summary["found"], 3)
        # کیفیت دومِ قسمت اول هم مال قسمت اول است، نه قسمت دوم
        self.assertEqual(
            {d.url for d in self._downloads_of(self.ep1)},
            {"https://dl.example.com/files/aa1.mkv", "https://dl.example.com/files/aa2.mkv"},
        )
        self.assertEqual(
            {d.url for d in self._downloads_of(self.ep2)},
            {"https://dl.example.com/files/bb1.mkv"},
        )
        self.assertEqual(self._downloads_of(self.show).count(), 0)
        self.assertEqual(
            download_source.attach_downloads(self.show, "series", [{
                "url": "https://dl.example.com/files/series-level.mkv", "title": "",
                "quality": "1080p", "size": "", "language": "original",
                "subtitle": False, "season": None, "episode": None,
            }]),
            0,
        )

    def test_series_without_episode_links_gets_nothing(self):
        def fake(_session, url):
            if "s=" in url or "/search" in url:
                return EP_SEARCH_HTML, url
            return NO_EPISODE_SERIES_HTML, url

        with patch("content_agent.download_source.fetch_html", side_effect=fake):
            summary = ContentAgent().fetch_downloads_for(self.show, "series")
        self.assertEqual(summary["found"], 0)
        self.assertEqual(summary["created"], 0)
        self.assertTrue(summary.get("reason"))
        self.assertEqual(self._downloads_of(self.show).count(), 0)
        self.assertEqual(self._downloads_of(self.ep1).count(), 0)


class EpisodeExtractionTest(TestCase):
    BASE = "https://dl.example.com/show/x/"

    def extract(self, html):
        from content_agent import download_source

        return download_source.extract_download_links(html, self.BASE)

    def test_trailer_links_are_skipped(self):
        html = """<html><body>
        <a href="https://dl.example.com/files/Show.Trailer.1080p.mp4">دانلود تریلر</a>
        <a href="https://dl.example.com/files/Show.S01E01.720p.mkv">دانلود قسمت 1</a>
        </body></html>"""
        links = self.extract(html)
        self.assertEqual(len(links), 1)
        self.assertEqual((links[0]["season"], links[0]["episode"]), (1, 1))

    def test_persian_ordinal_episode_numbers(self):
        html = """<html><body>
        <p>قسمت سوم: <a href="https://dl.example.com/files/x1.mkv">دانلود 720p</a></p>
        <p>قسمت چهارم: <a href="https://dl.example.com/files/x2.mkv">دانلود 720p</a></p>
        </body></html>"""
        links = self.extract(html)
        self.assertEqual([l["episode"] for l in links], [3, 4])


# ---------------------------------------------------------------------------
# افزودن دستی با IMDb ID از پنل: resolve، انتشار با لینک، ماندن پیش‌نویس
# بدون لینک (برخلاف کشف انبوه که حذف می‌کرد) و رد تکراری‌ها
# ---------------------------------------------------------------------------
class FakeTMDBClientImdb(FakeTMDBClient2):
    """find/{imdb_id} برای تست افزودن با IMDb.

    tt9990001 → فیلم 999001، tt9990101 → سریال 999101 و tt9990201 شناسه‌ی
    یک قسمت از همان سریال است (از قسمت هم باید به سریالش برسد).
    """

    FIND = {
        "tt9990001": {"movie_results": [{"id": 999001}], "tv_results": []},
        "tt9990101": {"movie_results": [], "tv_results": [{"id": 999101}]},
        "tt9990201": {
            "movie_results": [], "tv_results": [],
            "tv_episode_results": [{"show_id": 999101}],
        },
    }

    def _get(self, endpoint, params=None):
        if endpoint.startswith("find/"):
            imdb_id = endpoint.split("/", 1)[1]
            return self.FIND.get(imdb_id, {"movie_results": [], "tv_results": []})
        return super()._get(endpoint, params)


def _fake_fetch_nothing(_session, url):
    return "<html><body>بدون نتیجه</body></html>", url


class ImportByImdbTest(TestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        settings_obj = AgentSettings.load()
        settings_obj.translate_with_ai = False
        settings_obj.fetch_downloads = True
        settings_obj.download_source_url = "https://dl.example.com"
        settings_obj.save()

    @patch("content_agent.services.TMDBClient", FakeTMDBClientImdb)
    @patch("content_agent.download_source.fetch_html", side_effect=_fake_fetch_html)
    def test_series_by_imdb_published_with_episode_downloads(self, _fetch):
        item = ContentAgent().import_by_imdb("tt9990101")
        self.assertEqual(item.media_type, "series")
        self.assertEqual(item.status, AgentImportedItem.STATUS_APPROVED)
        show = Series.objects.get(tmdb_id=999101)
        self.assertTrue(show.is_active)
        run = item.run
        self.assertEqual(run.sources, ["imdb"])
        self.assertEqual(run.created_series, 1)
        self.assertEqual(run.status, AgentRun.STATUS_SUCCESS)
        from django.contrib.contenttypes.models import ContentType

        from downloads.models import Download
        from series.models import Episode

        ep_ct = ContentType.objects.get_for_model(Episode)
        self.assertEqual(Download.objects.filter(content_type=ep_ct).count(), 2)

    @patch("content_agent.services.TMDBClient", FakeTMDBClientImdb)
    @patch("content_agent.download_source.fetch_html", side_effect=_fake_fetch_nothing)
    def test_series_by_imdb_without_downloads_stays_draft(self, _fetch):
        # افزودن دستی است: بی‌لینک هم حذف نمی‌شود، پیش‌نویس می‌ماند
        item = ContentAgent().import_by_imdb("tt9990101")
        show = Series.objects.get(tmdb_id=999101)
        self.assertFalse(show.is_active)
        self.assertEqual(item.status, AgentImportedItem.STATUS_PENDING)
        self.assertEqual(item.object_id, show.id)

    @patch("content_agent.services.TMDBClient", FakeTMDBClientImdb)
    @patch("content_agent.download_source.fetch_html", side_effect=_fake_fetch_html)
    def test_movie_by_imdb_and_duplicate_rejected(self, _fetch):
        item = ContentAgent().import_by_imdb("9990001")  # بدون پیشوند tt هم می‌شود
        self.assertEqual(item.media_type, "movie")
        self.assertTrue(Movie.objects.get(tmdb_id=999001).is_active)
        from content_agent.services import AlreadyExists

        with self.assertRaises(AlreadyExists):
            ContentAgent().import_by_imdb("tt9990001")
        self.assertEqual(Movie.objects.filter(tmdb_id=999001).count(), 1)

    @patch("content_agent.services.TMDBClient", FakeTMDBClientImdb)
    @patch("content_agent.download_source.fetch_html", side_effect=_fake_fetch_nothing)
    def test_episode_imdb_resolves_to_its_series(self, _fetch):
        item = ContentAgent().import_by_imdb("tt9990201")
        self.assertEqual(item.media_type, "series")
        self.assertTrue(Series.objects.filter(tmdb_id=999101).exists())

    @patch("content_agent.services.TMDBClient", FakeTMDBClientImdb)
    def test_unknown_and_invalid_imdb(self):
        from content_agent.services import ImdbNotFound

        with self.assertRaises(ImdbNotFound):
            ContentAgent().import_by_imdb("tt0000000")
        with self.assertRaises(ValueError):
            ContentAgent().import_by_imdb("not-an-imdb")
        self.assertEqual(Series.objects.count(), 0)
        self.assertEqual(Movie.objects.count(), 0)

    @patch("content_agent.services.TMDBClient", FakeTMDBClientImdb)
    @patch("content_agent.download_source.fetch_html", side_effect=_fake_fetch_nothing)
    def test_blacklisted_item_can_be_added_manually(self, _fetch):
        run = AgentRun.objects.create(trigger_type=AgentRun.TRIGGER_MANUAL)
        AgentImportedItem.objects.create(
            run=run, media_type="series", tmdb_id=999101,
            imdb_id="tt9990101", title="ردشده‌ی قبلی",
            status=AgentImportedItem.STATUS_REJECTED, object_id=None,
        )
        item = ContentAgent().import_by_imdb("tt9990101")
        self.assertEqual(item.status, AgentImportedItem.STATUS_PENDING)
        self.assertEqual(
            AgentImportedItem.objects.filter(media_type="series", tmdb_id=999101).count(), 1
        )
        self.assertTrue(Series.objects.filter(tmdb_id=999101).exists())


@patch("content_agent.services.TMDBClient", FakeTMDBClientImdb)
class ImportByImdbApiTest(TestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        settings_obj = AgentSettings.load()
        settings_obj.translate_with_ai = False
        settings_obj.fetch_downloads = False
        settings_obj.download_source_url = ""
        settings_obj.save()
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username="imdbboss", email="imdbboss@test.ir",
            password="Str0ng!Pass123", is_staff=True, is_superuser=True
        )
        self.client.force_authenticate(self.admin)

    def test_import_series_endpoint(self):
        res = self.client.post(
            "/agent/import-by-imdb/", {"imdb_id": "tt9990101"}, format="json"
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["item"]["media_type"], "series")
        self.assertEqual(res.data["item"]["tmdb_id"], 999101)
        self.assertEqual(res.data["item"]["status"], "pending")
        self.assertTrue(Series.objects.filter(tmdb_id=999101).exists())

        # بار دوم: تکراری با لینک ویرایش اثر موجود
        res2 = self.client.post(
            "/agent/import-by-imdb/", {"imdb_id": "tt9990101"}, format="json"
        )
        self.assertEqual(res2.status_code, 409)
        self.assertIn("/admin/series/", res2.data["existing"]["admin_edit_path"])

    def test_import_endpoint_validation_and_not_found(self):
        res = self.client.post(
            "/agent/import-by-imdb/", {"imdb_id": "hello"}, format="json"
        )
        self.assertEqual(res.status_code, 400)
        res = self.client.post(
            "/agent/import-by-imdb/", {"imdb_id": "tt0000000"}, format="json"
        )
        self.assertEqual(res.status_code, 404)
        # نوع اجباری اشتباه: این IMDb سریال است، نه فیلم
        res = self.client.post(
            "/agent/import-by-imdb/",
            {"imdb_id": "tt9990101", "media_type": "movie"}, format="json",
        )
        self.assertEqual(res.status_code, 404)

    def test_import_endpoint_requires_agent_permission(self):
        staff = User.objects.create_user(
            username="imdbstaff", email="imdbstaff@test.ir",
            password="Str0ng!Pass123", is_staff=True
        )
        self.client.force_authenticate(staff)
        res = self.client.post(
            "/agent/import-by-imdb/", {"imdb_id": "tt9990101"}, format="json"
        )
        self.assertEqual(res.status_code, 403)
        self.assertFalse(Series.objects.exists())


# ---------------------------------------------------------------------------
# رگرسیون: لینک قسمت‌های سریال‌های دیگر (ستون کناری سایت دانلود) نباید به
# قسمت‌های این سریال بچسبد؛ صفحه‌ی دنبال‌شده باید مال همین سریال باشد.
# ---------------------------------------------------------------------------
SIDEBAR_SERIES_HTML = """<html><body>
<h1>Test Show</h1>
<a href="https://dl.example.com/files/Test.Show.Trailer.mp4">تریلر سریال</a>
<a href="https://dl.example.com/episode/test-show-ep1/">دانلود قسمت ۱</a>
<a href="https://dl.example.com/episode/test-show-ep2/">دانلود قسمت ۲</a>
<aside>
<h2>قسمت‌های تازه</h2>
<a href="https://dl.example.com/episode/other-show-ep1/">دانلود قسمت ۱ سریال دیگر</a>
<a href="https://dl.example.com/episode/another-show-ep2/">دانلود قسمت ۲ سریال دیگر</a>
</aside>
</body></html>"""

OTHER_SHOW_EP_HTML = """<html><body>
<h1>Other Show</h1>
<a href="https://dl.example.com/files/Other.Show.S01E01.720p.mkv">دانلود 720p</a>
<a href="https://dl.example.com/files/Other.Show.S01E01.1080p.mkv">دانلود 1080p</a>
</body></html>"""

ANOTHER_SHOW_EP_HTML = """<html><body>
<h1>Another Show</h1>
<a href="https://dl.example.com/files/Another.Show.S01E02.720p.mkv">دانلود 720p</a>
</body></html>"""

FOREIGN_DL_SERIES_HTML = """<html><body>
<h1>Test Show</h1>
<a href="https://dl.example.com/files/Test.Show.S01E01.720p.mkv">دانلود قسمت ۱</a>
<a href="https://dl.example.com/show/other-show/">دانلود سریال دیگر</a>
</body></html>"""

OTHER_SERIES_PAGE_HTML = """<html><body>
<h1>Other Show</h1>
<a href="https://dl.example.com/files/Other.Show.S01E01.1080p.mkv">دانلود 1080p</a>
</body></html>"""

NUMERIC_EP_SERIES_HTML = """<html><body>
<h1>Test Show</h1>
<a href="https://dl.example.com/ep/881/">دانلود قسمت ۱</a>
</body></html>"""

NUMERIC_EP_PAGE_HTML = """<html><body>
<h1>Test Show - قسمت ۱</h1>
<a href="https://dl.example.com/files/opaque-881.mkv">دانلود 720p</a>
</body></html>"""


def _fake_fetch_sidebar(_session, url):
    if "s=" in url or "/search" in url:
        return EP_SEARCH_HTML, url
    if "other-show-ep1" in url:
        return OTHER_SHOW_EP_HTML, url
    if "another-show-ep2" in url:
        return ANOTHER_SHOW_EP_HTML, url
    if "test-show-ep1" in url:
        return EP1_PAGE_HTML, url
    if "test-show-ep2" in url:
        return EP2_PAGE_HTML, url
    if url.rstrip("/").endswith("test-show"):
        return SIDEBAR_SERIES_HTML, url
    return "<html><body></body></html>", url


class SeriesForeignLinksTest(TestCase):
    def setUp(self):
        from django.core.cache import cache

        from series.models import Episode, Season, Series

        cache.clear()
        settings_obj = AgentSettings.load()
        settings_obj.translate_with_ai = False
        settings_obj.fetch_downloads = True
        settings_obj.download_source_url = "https://dl.example.com"
        settings_obj.save()
        self.show = Series.objects.create(
            title="سریال تستی", original_title="Test Show",
            imdb_id="tt9990101", tmdb_id=999101,
        )
        season = Season.objects.create(series=self.show, season_number=1)
        self.ep1 = Episode.objects.create(season=season, episode_number=1)
        self.ep2 = Episode.objects.create(season=season, episode_number=2)

    def _downloads_of(self, obj):
        from django.contrib.contenttypes.models import ContentType

        from downloads.models import Download

        ct = ContentType.objects.get_for_model(obj.__class__)
        return Download.objects.filter(content_type=ct, object_id=obj.id)

    @patch("content_agent.download_source.fetch_html", side_effect=_fake_fetch_sidebar)
    def test_sidebar_episode_pages_of_other_series_are_ignored(self, _fetch):
        summary = ContentAgent().fetch_downloads_for(self.show, "series")
        self.assertEqual(summary["found"], 3)
        self.assertEqual(
            {d.url for d in self._downloads_of(self.ep1)},
            {"https://dl.example.com/files/opaque-111.mkv",
             "https://dl.example.com/files/opaque-112.mkv"},
        )
        self.assertEqual(
            {d.url for d in self._downloads_of(self.ep2)},
            {"https://dl.example.com/files/opaque-211.mkv"},
        )
        from downloads.models import Download

        self.assertEqual(Download.objects.count(), 3)
        self.assertFalse(Download.objects.filter(url__icontains="Other.Show").exists())
        self.assertFalse(Download.objects.filter(url__icontains="Another.Show").exists())

    def test_foreign_download_page_is_ignored(self):
        def fake(_session, url):
            if "s=" in url or "/search" in url:
                return EP_SEARCH_HTML, url
            if "other-show" in url:
                return OTHER_SERIES_PAGE_HTML, url
            return FOREIGN_DL_SERIES_HTML, url

        with patch("content_agent.download_source.fetch_html", side_effect=fake):
            summary = ContentAgent().fetch_downloads_for(self.show, "series")
        self.assertEqual(summary["found"], 1)
        self.assertEqual(
            {d.url for d in self._downloads_of(self.ep1)},
            {"https://dl.example.com/files/Test.Show.S01E01.720p.mkv"},
        )
        from downloads.models import Download

        self.assertFalse(Download.objects.filter(url__icontains="Other.Show").exists())

    def test_numeric_episode_page_verified_by_page_text(self):
        def fake(_session, url):
            if "s=" in url or "/search" in url:
                return EP_SEARCH_HTML, url
            if "ep/881" in url:
                return NUMERIC_EP_PAGE_HTML, url
            return NUMERIC_EP_SERIES_HTML, url

        with patch("content_agent.download_source.fetch_html", side_effect=fake):
            summary = ContentAgent().fetch_downloads_for(self.show, "series")
        self.assertEqual(summary["found"], 1)
        self.assertEqual(
            {d.url for d in self._downloads_of(self.ep1)},
            {"https://dl.example.com/files/opaque-881.mkv"},
        )


# ---------------------------------------------------------------------------
# مقاوم‌سازی پیدا کردن لینک قسمت‌ها: تطابق بخشی عنوان (اسلاگ کوتاه‌تر)،
# لینک قسمت با متنِ عنوان قسمت زیر همان اسلاگ، و شمردن فقط قسمت‌های موجود
# ---------------------------------------------------------------------------
PARTIAL_SERIES_HTML = """<html><body>
<h1>Test Show</h1>
<a href="https://dl.example.com/episode/test-show-ep1/">دانلود قسمت ۱</a>
</body></html>"""

PARTIAL_EP_HTML = """<html><body>
<h1>Test Show</h1>
<a href="https://dl.example.com/files/partial-101.mkv">دانلود 720p</a>
</body></html>"""

TITLE_ONLY_SERIES_HTML = """<html><body>
<h1>Test Show</h1>
<a href="https://dl.example.com/show/test-show/1/">Pilot</a>
</body></html>"""

TITLE_ONLY_EP_HTML = """<html><body>
<h1>Test Show قسمت ۱</h1>
<a href="https://dl.example.com/files/opaque-901.mkv">دانلود 720p</a>
</body></html>"""

FUTURE_EP_SERIES_HTML = """<html><body>
<h1>Test Show</h1>
<a href="https://dl.example.com/files/Test.Show.S01E01.720p.mkv">دانلود قسمت ۱</a>
<a href="https://dl.example.com/files/Test.Show.S01E09.720p.mkv">دانلود قسمت ۹</a>
</body></html>"""


class SeriesLinkFindingRobustnessTest(TestCase):
    def setUp(self):
        from django.core.cache import cache

        from series.models import Episode, Season, Series

        cache.clear()
        settings_obj = AgentSettings.load()
        settings_obj.translate_with_ai = False
        settings_obj.fetch_downloads = True
        settings_obj.download_source_url = "https://dl.example.com"
        settings_obj.save()
        self.Series = Series
        self.show = Series.objects.create(
            title="سریال تستی", original_title="Test Show",
            imdb_id="tt9990101", tmdb_id=999101,
        )
        season = Season.objects.create(series=self.show, season_number=1)
        self.ep1 = Episode.objects.create(season=season, episode_number=1)
        self.ep2 = Episode.objects.create(season=season, episode_number=2)

    def _downloads_of(self, obj):
        from django.contrib.contenttypes.models import ContentType

        from downloads.models import Download

        ct = ContentType.objects.get_for_model(obj.__class__)
        return Download.objects.filter(content_type=ct, object_id=obj.id)

    def _fetch_with(self, fake):
        with patch("content_agent.download_source.fetch_html", side_effect=fake):
            return ContentAgent().fetch_downloads_for(self.show, "series")

    def test_partial_title_match_pages_accepted(self):
        # عنوان کامل TMDB سه واژه دارد ولی سایت با نام کوتاه‌تر می‌شناسد؛
        # صفحه‌های واقعی نباید به‌خاطر نبودن یک واژه رد شوند.
        from series.models import Episode, Season

        show = self.Series.objects.create(
            title="سریال برگشته", original_title="Test Show Returns",
            imdb_id="tt9990301", tmdb_id=999301,
        )
        season = Season.objects.create(series=show, season_number=1)
        ep1 = Episode.objects.create(season=season, episode_number=1)

        def fake(_session, url):
            if "s=" in url or "/search" in url:
                return EP_SEARCH_HTML, url
            if "test-show-ep1" in url:
                return PARTIAL_EP_HTML, url
            return PARTIAL_SERIES_HTML, url

        with patch("content_agent.download_source.fetch_html", side_effect=fake):
            summary = ContentAgent().fetch_downloads_for(show, "series")
        self.assertEqual(summary["found"], 1)
        self.assertEqual(
            {d.url for d in self._downloads_of(ep1)},
            {"https://dl.example.com/files/partial-101.mkv"},
        )

    def test_episode_title_anchor_in_slug_family_followed(self):
        # متن لینک فقط عنوان قسمت است («Pilot») و در آدرسش هم کلمه‌ی
        # episode/قسمت نیست؛ چون زیر اسلاگ خود سریال است دنبال می‌شود.
        def fake(_session, url):
            if "s=" in url or "/search" in url:
                return EP_SEARCH_HTML, url
            if url.rstrip("/").endswith("test-show/1"):
                return TITLE_ONLY_EP_HTML, url
            return TITLE_ONLY_SERIES_HTML, url

        summary = self._fetch_with(fake)
        self.assertEqual(summary["found"], 1)
        self.assertEqual(
            {d.url for d in self._downloads_of(self.ep1)},
            {"https://dl.example.com/files/opaque-901.mkv"},
        )

    def test_found_counts_only_existing_episodes(self):
        # قسمت ۹ در سایت دانلود هست ولی در سایت ما وارد نشده؛ نباید سریال
        # را «دارای لینک» حساب کند.
        def fake(_session, url):
            if "s=" in url or "/search" in url:
                return EP_SEARCH_HTML, url
            return FUTURE_EP_SERIES_HTML, url

        summary = self._fetch_with(fake)
        self.assertEqual(summary["found"], 1)
        self.assertEqual(self._downloads_of(self.ep1).count(), 1)
        from downloads.models import Download

        self.assertEqual(Download.objects.count(), 1)

    def test_attach_seasonless_episode_number_unique_match(self):
        from content_agent import download_source
        from series.models import Episode, Season

        season2 = Season.objects.create(series=self.show, season_number=2)
        ep_s2_1 = Episode.objects.create(season=season2, episode_number=1)
        ep_s2_5 = Episode.objects.create(season=season2, episode_number=5)
        created = download_source.attach_downloads(self.show, "series", [
            {"url": "https://dl.example.com/files/s2e5.mkv", "title": "",
             "quality": "720p", "size": "", "language": "original",
             "subtitle": False, "season": None, "episode": 5},
            {"url": "https://dl.example.com/files/ambig.mkv", "title": "",
             "quality": "720p", "size": "", "language": "original",
             "subtitle": False, "season": None, "episode": 1},
        ])
        # قسمت ۵ فقط در فصل ۲ هست → وصل شد؛ قسمت ۱ در هر دو فصل هست و
        # بدون فصل حدس زده نمی‌شود → وصل نشد.
        self.assertEqual(created, 1)
        self.assertEqual(
            {d.url for d in self._downloads_of(ep_s2_5)},
            {"https://dl.example.com/files/s2e5.mkv"},
        )
        self.assertEqual(self._downloads_of(ep_s2_1).count(), 0)
        self.assertEqual(self._downloads_of(self.ep1).count(), 0)
