from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from movies.models import Movie
from .models import Download
from .serializers import DownloadSerializer

User = get_user_model()


class DownloadUrlVisibilityTest(TestCase):
    """URL دانلود فقط برای VIP؛ کاربر عادیِ لاگین‌کرده نباید ببیند."""

    def setUp(self):
        self.factory = APIRequestFactory()
        movie = Movie.objects.create(
            title="فیلم", imdb_id="tt0000021", runtime=90
        )
        self.download = Download.objects.create(
            content_object=movie, quality="1080p", is_vip=True,
            url="https://cdn.example.com/file.mkv",
        )
        self.free_download = Download.objects.create(
            content_object=movie, quality="720p", is_vip=False,
            url="https://cdn.example.com/free.mkv",
        )
        self.free_user = User.objects.create_user(
            username="free", email="f@test.ir", password="Str0ng!Pass123"
        )
        self.vip_user = User.objects.create_user(
            username="vip", email="v@test.ir", password="Str0ng!Pass123",
            is_vip=True,
        )

    def _url_for(self, user, download=None):
        request = self.factory.get("/")
        if user is not None:
            force_authenticate(request, user=user)
            request.user = user
        else:
            from django.contrib.auth.models import AnonymousUser
            request.user = AnonymousUser()
        data = DownloadSerializer(
            download or self.download, context={"request": request}
        ).data
        return data["url"]

    def test_anonymous_gets_no_url(self):
        self.assertIsNone(self._url_for(None))

    def test_free_user_gets_no_vip_url(self):
        self.assertIsNone(self._url_for(self.free_user))

    def test_free_user_gets_free_download_url(self):
        self.assertEqual(
            self._url_for(self.free_user, self.free_download),
            "https://cdn.example.com/free.mkv",
        )

    def test_vip_user_gets_url(self):
        self.assertEqual(
            self._url_for(self.vip_user), "https://cdn.example.com/file.mkv"
        )
