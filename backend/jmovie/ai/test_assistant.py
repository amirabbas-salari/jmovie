"""تست‌های دستیار سینمایی مجازی: ابزارهای کاتالوگ، مغز مکالمه، توکن LiveKit.

اصل کلیدی: داده فقط از کاتالوگ واقعی می‌آید و خطای احراز هویت/دسترسی
به‌درستی برگردانده می‌شود. هیچ‌کدام نیاز به سرویس خارجی ندارند.
"""
from unittest import mock

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from genres.models import Genre
from movies.models import Movie
from series.models import Series

from . import assistant_tools


class AssistantCatalogBase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.g_scifi = Genre.objects.create(name="علمی‌تخیلی", slug="science-fiction")
        cls.g_drama = Genre.objects.create(name="درام", slug="drama")
        cls.g_crime = Genre.objects.create(name="جنایی", slug="crime")

        cls.inception = Movie.objects.create(
            title="اینسپشن", original_title="Inception", imdb_id="tt1375666",
            year=2010, imdb_rating=8.8, runtime=148, is_active=True,
        )
        cls.inception.genres.add(cls.g_scifi, cls.g_drama)

        cls.interstellar = Movie.objects.create(
            title="اینتراستلار", original_title="Interstellar", imdb_id="tt0816692",
            year=2014, imdb_rating=8.7, runtime=169, is_active=True,
        )
        cls.interstellar.genres.add(cls.g_scifi, cls.g_drama)

        cls.hidden = Movie.objects.create(
            title="فیلم مخفی", imdb_id="tt9999999", year=2020, imdb_rating=9.5, runtime=90,
            is_active=False,
        )
        cls.hidden.genres.add(cls.g_scifi)

        cls.breaking = Series.objects.create(
            title="بریکینگ بد", original_title="Breaking Bad", imdb_id="tt0903747",
            imdb_rating=9.5, is_active=True,
        )
        cls.breaking.genres.add(cls.g_crime, cls.g_drama)


class AssistantToolsTest(AssistantCatalogBase):
    def test_search_movies_returns_structured_cards(self):
        result = assistant_tools.search_movies(query="Inception")
        self.assertEqual(len(result["results"]), 1)
        card = result["results"][0]
        self.assertEqual(card["title"], "اینسپشن")
        self.assertEqual(card["media_type"], "movie")
        self.assertEqual(card["url"], f"/movie/{card['slug']}")
        self.assertEqual(card["rating"], 8.8)
        self.assertIn("علمی‌تخیلی", card["genres"])

    def test_inactive_titles_are_never_returned(self):
        result = assistant_tools.search_movies(genre="علمی‌تخیلی")
        titles = [c["title"] for c in result["results"]]
        self.assertNotIn("فیلم مخفی", titles)

    def test_get_title_details_found_and_missing(self):
        found = assistant_tools.get_title_details("اینتراستلار")
        self.assertTrue(found["found"])
        self.assertEqual(found["runtime"], 169)
        missing = assistant_tools.get_title_details("فیلم وجود ندارد")
        self.assertFalse(missing["found"])

    def test_compare_titles_reports_missing(self):
        result = assistant_tools.compare_titles(["اینسپشن", "فیلم وجود ندارد"])
        self.assertEqual(len(result["items"]), 1)
        self.assertEqual(result["missing"], ["فیلم وجود ندارد"])

    def test_recommend_by_genre(self):
        result = assistant_tools.recommend_titles(genres=["جنایی"], media_type="series")
        self.assertEqual([c["title"] for c in result["results"]], ["بریکینگ بد"])

    def test_similar_titles(self):
        result = assistant_tools.search_similar_titles("اینسپشن")
        self.assertTrue(result["found"])
        similar_titles = [c["title"] for c in result["results"]]
        self.assertIn("اینتراستلار", similar_titles)
        self.assertNotIn("اینسپشن", similar_titles)


class AssistantBrainTest(AssistantCatalogBase):
    def test_genre_recommendation_returns_cards(self):
        from .assistant_brain import respond

        result = respond("یه فیلم علمی‌تخیلی پیشنهاد بده")
        self.assertTrue(result["titles"])
        self.assertIn("اینسپشن", result["reply"])

    def test_greeting(self):
        from .assistant_brain import respond

        result = respond("سلام")
        self.assertIn("چه فیلمی", result["reply"])

    def test_similar_with_filler_words(self):
        from .assistant_brain import respond

        result = respond("شبیه اینسپشن چی داریم؟")
        self.assertEqual([c["title"] for c in result["titles"]], ["اینتراستلار"])

    def test_compare_flow(self):
        from .assistant_brain import respond

        result = respond("مقایسه اینسپشن و اینتراستلار")
        self.assertEqual(len(result["titles"]), 2)


class AssistantTokenTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_token_requires_livekit_config(self):
        with mock.patch.dict("os.environ", {}, clear=False):
            for key in ("LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"):
                mock.patch.dict("os.environ", {key: ""}).start()
            response = self.client.post(
                "/ai/assistant/livekit-token/", {"session_id": "abc"}, format="json"
            )
        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.data["livekit_configured"])

    def test_token_issued_with_config(self):
        env = {
            "LIVEKIT_URL": "wss://example.livekit.cloud",
            "LIVEKIT_API_KEY": "APItestkey",
            "LIVEKIT_API_SECRET": "test-secret-not-real",
        }
        with mock.patch.dict("os.environ", env):
            response = self.client.post(
                "/ai/assistant/livekit-token/", {"session_id": "abc123"}, format="json"
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["url"], "wss://example.livekit.cloud")
        self.assertEqual(response.data["room"], "jmovie-assistant-abc123")
        # توکن با همان سکرت قابل راستی‌آزمایی است و انقضای کوتاه دارد
        import jwt as pyjwt

        payload = pyjwt.decode(
            response.data["token"], "test-secret-not-real",
            algorithms=["HS256"], issuer="APItestkey", options={"verify_aud": False},
        )
        self.assertEqual(payload["video"]["room"], "jmovie-assistant-abc123")
        self.assertTrue(payload["video"]["roomJoin"])
        self.assertLessEqual(payload["exp"] - payload["iat"], 15 * 60)

    def test_message_fallback_is_free_and_catalog_backed(self):
        response = self.client.post(
            "/ai/assistant/message/", {"message": "سلام"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["mode"], "browser")
        self.assertIn("reply", response.data)

    def test_status_endpoint(self):
        response = self.client.get("/ai/assistant/status/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["browser_mode"])
