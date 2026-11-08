from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.test import TestCase
from rest_framework.test import APIClient

from movies.models import Movie
from .models import Comment

User = get_user_model()


class CommentModerationSecurityTest(TestCase):
    """کامنت تأییدنشده/غیرفعال نباید عمومی دیده شود (عبور از moderation)."""

    def setUp(self):
        self.client = APIClient()
        self.author = User.objects.create_user(
            username="author", email="a@test.ir", password="Str0ng!Pass123"
        )
        self.other = User.objects.create_user(
            username="other", email="o@test.ir", password="Str0ng!Pass123"
        )
        self.movie = Movie.objects.create(
            title="فیلم", imdb_id="tt0000011", runtime=90
        )
        ct = ContentType.objects.get_for_model(Movie)
        self.approved = Comment.objects.create(
            user=self.author, text="تأیید شده",
            content_type=ct, object_id=self.movie.id,
            is_active=True, is_approved=True,
        )
        self.pending = Comment.objects.create(
            user=self.author, text="در انتظار تأیید",
            content_type=ct, object_id=self.movie.id,
            is_active=True, is_approved=False,
        )
        self.inactive = Comment.objects.create(
            user=self.author, text="حذف شده توسط مدیر",
            content_type=ct, object_id=self.movie.id,
            is_active=False, is_approved=True,
        )

    def _texts(self, response):
        return [c["text"] for c in response.data["results"]]

    def test_anonymous_sees_only_approved_active(self):
        res = self.client.get("/comments/")
        self.assertEqual(res.status_code, 200)
        texts = self._texts(res)
        self.assertIn("تأیید شده", texts)
        self.assertNotIn("در انتظار تأیید", texts)
        self.assertNotIn("حذف شده توسط مدیر", texts)

    def test_author_sees_own_pending_but_others_do_not(self):
        self.client.force_authenticate(self.other)
        texts = self._texts(self.client.get("/comments/"))
        self.assertNotIn("در انتظار تأیید", texts)

        self.client.force_authenticate(self.author)
        texts = self._texts(self.client.get("/comments/"))
        self.assertIn("در انتظار تأیید", texts)

    def test_create_rejects_disallowed_content_type(self):
        self.client.force_authenticate(self.author)
        user_ct = ContentType.objects.get_for_model(User)
        res = self.client.post("/comments/", {
            "text": "حمله",
            "content_type": user_ct.id,
            "object_id": self.other.id,
        }, format="json")
        self.assertEqual(res.status_code, 400)

    def test_create_rejects_parent_from_another_media(self):
        self.client.force_authenticate(self.author)
        other_movie = Movie.objects.create(
            title="فیلم ۲", imdb_id="tt0000012", runtime=80
        )
        ct = ContentType.objects.get_for_model(Movie)
        foreign_parent = Comment.objects.create(
            user=self.author, text="والد بیگانه",
            content_type=ct, object_id=other_movie.id,
            is_active=True, is_approved=True,
        )
        res = self.client.post("/comments/", {
            "text": "پاسخ",
            "parent": foreign_parent.id,
            "content_type": ct.id,
            "object_id": self.movie.id,
        }, format="json")
        self.assertEqual(res.status_code, 400)
