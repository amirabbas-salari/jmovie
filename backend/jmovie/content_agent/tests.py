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
