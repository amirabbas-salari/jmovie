from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from movies.models import Movie
from series.models import Series
from .models import MovieUserStatus, SeriesUserStatus

User = get_user_model()


class MyListsApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="ali", email="ali@example.com", password="Str0ng!Pass"
        )
        self.other = User.objects.create_user(
            username="sara", email="sara@example.com", password="Str0ng!Pass"
        )
        self.movie = Movie.objects.create(
            imdb_id="tt0000001", title="فیلم تست", original_title="Test Movie",
            runtime=100,
        )
        self.series = Series.objects.create(
            imdb_id="tt0000002", title="سریال تست", original_title="Test Series",
        )

    def toggle(self, **payload):
        return self.client.post("/accounts/my-lists/toggle/", payload, format="json")

    def test_toggle_requires_auth(self):
        res = self.toggle(media_type="movie", media_id=self.movie.id, list="favorite")
        self.assertEqual(res.status_code, 401)

    def test_toggle_favorite_movie_on_and_off(self):
        self.client.force_authenticate(self.user)

        res = self.toggle(media_type="movie", media_id=self.movie.id, list="favorite")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["active"])
        self.assertTrue(
            MovieUserStatus.objects.filter(
                user=self.user, movie=self.movie, status="favorite"
            ).exists()
        )

        res = self.toggle(media_type="movie", media_id=self.movie.id, list="favorite")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data["active"])
        self.assertFalse(MovieUserStatus.objects.filter(user=self.user).exists())

    def test_toggle_series_watchlist(self):
        self.client.force_authenticate(self.user)
        res = self.toggle(media_type="series", media_id=self.series.id, list="watchlist")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["active"])
        self.assertTrue(
            SeriesUserStatus.objects.filter(
                user=self.user, series=self.series, status="watch_later"
            ).exists()
        )

    def test_toggle_validation(self):
        self.client.force_authenticate(self.user)
        self.assertEqual(
            self.toggle(media_type="movie", media_id=self.movie.id, list="nope").status_code,
            400,
        )
        self.assertEqual(
            self.toggle(media_type="book", media_id=1, list="favorite").status_code,
            400,
        )
        self.assertEqual(
            self.toggle(media_type="movie", media_id=99999, list="favorite").status_code,
            404,
        )

    def test_my_lists_returns_media_and_is_isolated(self):
        self.client.force_authenticate(self.user)
        self.toggle(media_type="movie", media_id=self.movie.id, list="favorite")
        self.toggle(media_type="series", media_id=self.series.id, list="watchlist")

        res = self.client.get("/accounts/my-lists/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["favorite"]), 1)
        self.assertEqual(res.data["favorite"][0]["media_type"], "movie")
        self.assertEqual(res.data["favorite"][0]["media"]["title"], "فیلم تست")
        self.assertEqual(len(res.data["watchlist"]), 1)
        self.assertEqual(res.data["watchlist"][0]["media_type"], "series")
        self.assertEqual(res.data["watched"], [])

        # کاربر دیگر نباید لیست این کاربر را ببیند
        self.client.force_authenticate(self.other)
        res = self.client.get("/accounts/my-lists/")
        self.assertEqual(res.data["favorite"], [])
        self.assertEqual(res.data["watchlist"], [])

    def test_ids_endpoint(self):
        self.client.force_authenticate(self.user)
        self.toggle(media_type="series", media_id=self.series.id, list="favorite")

        res = self.client.get("/accounts/my-lists/ids/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["favorite"]["series"], [self.series.id])
        self.assertEqual(res.data["favorite"]["movie"], [])


class AuthErrorMessagesTest(TestCase):
    """پیام‌های خطای فارسی و قابل نمایش برای فرم‌های ورود/ثبت‌نام."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="authuser", email="auth@test.ir", password="Str0ng!Pass123"
        )

    def test_login_wrong_password_returns_persian_error(self):
        res = self.client.post(
            "/api/token/",
            {"username": "authuser", "password": "wrong-pass"},
            format="json",
        )
        self.assertEqual(res.status_code, 401)
        self.assertIn("اشتباه", res.data["detail"])

    def test_login_unknown_user_returns_same_persian_error(self):
        res = self.client.post(
            "/api/token/",
            {"username": "no_such_user", "password": "whatever1"},
            format="json",
        )
        self.assertEqual(res.status_code, 401)
        self.assertIn("اشتباه", res.data["detail"])

    def test_login_success_returns_tokens(self):
        res = self.client.post(
            "/api/token/",
            {"username": "authuser", "password": "Str0ng!Pass123"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.data)
        self.assertIn("refresh", res.data)

    def test_register_duplicate_username_persian_error(self):
        res = self.client.post("/accounts/register/", {
            "username": "authuser", "email": "new@test.ir",
            "password": "Str0ng!Pass123", "password2": "Str0ng!Pass123",
        }, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("قبلاً ثبت شده", str(res.data["username"][0]))

    def test_register_duplicate_email_persian_error(self):
        res = self.client.post("/accounts/register/", {
            "username": "another", "email": "auth@test.ir",
            "password": "Str0ng!Pass123", "password2": "Str0ng!Pass123",
        }, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("قبلاً ثبت شده", str(res.data["email"][0]))

    def test_register_weak_password_persian_error(self):
        res = self.client.post("/accounts/register/", {
            "username": "weakuser", "email": "weak@test.ir",
            "password": "123", "password2": "123",
        }, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("کوتاه", str(res.data["password"][0]))

    def test_register_password_mismatch_persian_error(self):
        res = self.client.post("/accounts/register/", {
            "username": "mismatch", "email": "mm@test.ir",
            "password": "Str0ng!Pass123", "password2": "Str0ng!Pass124",
        }, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("مطابقت", str(res.data["password2"][0]))

    def test_register_success(self):
        res = self.client.post("/accounts/register/", {
            "username": "newuser", "email": "new2@test.ir",
            "password": "Str0ng!Pass123", "password2": "Str0ng!Pass123",
        }, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertTrue(User.objects.filter(username="newuser").exists())
