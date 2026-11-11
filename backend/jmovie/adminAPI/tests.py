from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from genres.models import Genre
from people.models import Person
from movies.models import Movie

User = get_user_model()


def make_user(username, **kwargs):
    return User.objects.create_user(username=username, email=f"{username}@test.ir",
                                    password="Str0ng!Pass123", **kwargs)


class AdminRBACTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.superadmin = make_user("root", is_staff=True, is_superuser=True)
        self.content_admin = make_user("content", is_staff=True)
        role = Group.objects.create(name="مدیر محتوا")
        role.permissions.set(Permission.objects.filter(
            codename__in=["view_movie", "add_movie", "change_movie", "view_genre"],
        ))
        self.content_admin.groups.add(role)
        self.viewer = make_user("viewer", is_staff=True)  # staff بدون هیچ مجوزی
        self.regular = make_user("regular")
        Movie.objects.create(title="فیلم تست", imdb_id="tt0000001", runtime=100)

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def test_superadmin_has_full_access(self):
        self.auth(self.superadmin)
        self.assertEqual(self.client.get("/admin/movies/").status_code, 200)
        self.assertEqual(self.client.get("/admin/roles/").status_code, 200)
        me = self.client.get("/admin/me/")
        self.assertEqual(me.data["permissions"], ["*"])

    def test_content_admin_can_edit_movies_but_not_roles_or_users(self):
        self.auth(self.content_admin)
        self.assertEqual(self.client.get("/admin/movies/").status_code, 200)
        created = self.client.post("/admin/movies/", {
            "title": "فیلم جدید", "imdb_id": "tt0000002", "runtime": 90,
        }, format="json")
        self.assertEqual(created.status_code, 201)
        # حذف فیلم مجوزش را ندارد
        self.assertEqual(self.client.delete(f"/admin/movies/{created.data['id']}/").status_code, 403)
        # مدیریت نقش و کاربران برای او بسته است
        self.assertEqual(self.client.get("/admin/roles/").status_code, 403)
        self.assertEqual(self.client.get("/admin/users/").status_code, 403)
        self.assertEqual(self.client.get("/admin/permissions/").status_code, 403)

    def test_staff_without_permissions_is_denied(self):
        self.auth(self.viewer)
        self.assertEqual(self.client.get("/admin/movies/").status_code, 403)
        # داشبورد و me برای هر staff باز است
        self.assertEqual(self.client.get("/admin/me/").status_code, 200)

    def test_regular_user_cannot_enter_admin(self):
        self.auth(self.regular)
        self.assertEqual(self.client.get("/admin/movies/").status_code, 403)
        self.assertEqual(self.client.get("/admin/me/").status_code, 403)
        anon = APIClient()
        self.assertEqual(anon.get("/admin/movies/").status_code, 401)

    def test_only_superadmin_can_assign_roles(self):
        self.auth(self.content_admin)
        resp = self.client.post(f"/admin/users/{self.viewer.id}/assign_roles/", {"role_ids": []}, format="json")
        self.assertIn(resp.status_code, (403, 404))  # اول مجوز view_user ندارد → 403
        self.auth(self.superadmin)
        resp = self.client.post(f"/admin/users/{self.viewer.id}/assign_roles/", {"role_ids": []}, format="json")
        self.assertEqual(resp.status_code, 200)

    def test_content_admin_cannot_escalate_privileges_via_user_update(self):
        # پشتیبان کاربران: change_user دارد ولی نباید بتواند خودش را سوپرادمین کند
        support = make_user("support", is_staff=True)
        role = Group.objects.create(name="پشتیبان")
        role.permissions.set(Permission.objects.filter(codename__in=["view_user", "change_user"]))
        support.groups.add(role)
        self.auth(support)
        resp = self.client.patch(f"/admin/users/{support.id}/", {"is_superuser": True}, format="json")
        self.assertEqual(resp.status_code, 403)
        support.refresh_from_db()
        self.assertFalse(support.is_superuser)

    def test_dashboard_single_endpoint(self):
        self.auth(self.superadmin)
        resp = self.client.get("/admin/dashboard/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["stats"]["movies"], 1)

    def test_genre_crud_and_audit_log(self):
        self.auth(self.superadmin)
        created = self.client.post("/admin/genres/", {"name": "اکشن", "slug": "action"}, format="json")
        self.assertEqual(created.status_code, 201)
        logs = self.client.get("/admin/audit-logs/")
        self.assertEqual(logs.status_code, 200)
        self.assertGreaterEqual(logs.data["count"], 1)
        self.assertTrue(Genre.objects.filter(slug="action").exists())


class TmdbLookupTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.superadmin = make_user("tmdbroot", is_staff=True, is_superuser=True)
        Genre.objects.create(name="درام", slug="drama", tmdb_id=18)
        Person.objects.create(tmdb_id="500", name="بازیگر موجود")

    def test_lookup_requires_staff(self):
        regular = make_user("plain")
        self.client.force_authenticate(user=regular)
        self.assertEqual(self.client.get("/admin/tmdb/lookup/", {"type": "movie", "value": "tt1"}).status_code, 403)

    def test_lookup_without_api_key_returns_503(self):
        self.client.force_authenticate(user=self.superadmin)
        with override_settings(TMDB_API_KEY=""):
            resp = self.client.get("/admin/tmdb/lookup/", {"type": "movie", "value": "tt0816692"})
        self.assertEqual(resp.status_code, 503)

    def test_lookup_normalizes_and_matches_local(self):
        self.client.force_authenticate(user=self.superadmin)
        fake_data = {
            "id": 27205, "title": "Inception", "original_title": "Inception",
            "overview": "خواب در خواب", "release_date": "2010-07-16", "runtime": 148,
            "vote_average": 8.4, "vote_count": 35000,
            "poster_path": "/p.jpg", "backdrop_path": "/b.jpg",
            "production_countries": [{"name": "United States"}],
            "external_ids": {"imdb_id": "tt1375666"},
            "genres": [{"id": 18, "name": "درام"}, {"id": 878, "name": "علمی‌تخیلی"}],
            "credits": {
                "cast": [{"id": 500, "name": "بازیگر موجود", "character": "Cobb", "profile_path": "/a.jpg"},
                         {"id": 999, "name": "فرد جدید", "character": "X", "profile_path": None}],
                "crew": [{"id": 501, "name": "کارگردان", "job": "Director", "profile_path": None}],
            },
        }
        with override_settings(TMDB_API_KEY="test-key"), \
                patch("adminAPI.views.TMDBClient") as MockClient:
            MockClient.return_value.movie_full_details.return_value = fake_data
            resp = self.client.get("/admin/tmdb/lookup/", {"type": "movie", "by": "tmdb_id", "value": "27205"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["title"], "Inception")
        self.assertEqual(resp.data["imdb_id"], "tt1375666")
        self.assertTrue(resp.data["poster_url"].endswith("/p.jpg"))
        genres = {g["tmdb_id"]: g["local_id"] for g in resp.data["genres"]}
        self.assertIsNotNone(genres[18])
        self.assertIsNone(genres[878])
        cast = {c["tmdb_id"]: c for c in resp.data["cast"]}
        self.assertIsNotNone(cast["500"]["local_id"])
        self.assertEqual(cast["501"]["role"], "director")


class AdminVipEscalationTest(TestCase):
    """ادمین عادی (حتی با مجوز ویرایش کاربر) نباید بتواند کسی را VIP کند."""

    def setUp(self):
        self.client = APIClient()
        self.superadmin = make_user("root2", is_staff=True, is_superuser=True)
        self.user_admin = make_user("usermgr", is_staff=True)
        role = Group.objects.create(name="مدیر کاربران")
        role.permissions.set(Permission.objects.filter(
            codename__in=["view_user", "change_user"],
        ))
        self.user_admin.groups.add(role)
        self.target = make_user("target")

    def test_staff_cannot_grant_vip(self):
        self.client.force_authenticate(user=self.user_admin)
        res = self.client.patch(
            f"/admin/users/{self.target.id}/",
            {"is_vip": True}, format="json",
        )
        self.assertEqual(res.status_code, 403)
        self.target.refresh_from_db()
        self.assertFalse(self.target.is_vip)

    def test_superadmin_can_grant_vip(self):
        self.client.force_authenticate(user=self.superadmin)
        res = self.client.patch(
            f"/admin/users/{self.target.id}/",
            {"is_vip": True}, format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.target.refresh_from_db()
        self.assertTrue(self.target.is_vip)


class AdminBulkDeleteTest(TestCase):
    """حذف گروهی و پاکسازی آثار بدون لینک دانلود."""

    def setUp(self):
        from django.contrib.contenttypes.models import ContentType

        from downloads.models import Download
        from series.models import Episode, Season

        self.client = APIClient()
        self.superadmin = make_user("bulkroot", is_staff=True, is_superuser=True)
        self.deleter = make_user("deleter", is_staff=True)
        role = Group.objects.create(name="حذف‌کننده")
        role.permissions.set(Permission.objects.filter(
            codename__in=["view_movie", "delete_movie", "view_series", "delete_series"],
        ))
        self.deleter.groups.add(role)

        self.m1 = Movie.objects.create(title="فیلم ۱", imdb_id="tt1000001", runtime=90)
        self.m2 = Movie.objects.create(title="فیلم ۲", imdb_id="tt1000002", runtime=90)
        movie_ct = ContentType.objects.get_for_model(Movie)
        Download.objects.create(
            content_type=movie_ct, object_id=self.m1.id,
            quality="1080p", url="https://dl.example.com/a.mkv",
        )
        # سریال بدون فصل/لینک و سریالی که قسمتش لینک دارد
        from series.models import Series
        self.s_empty = Series.objects.create(title="سریال خالی", imdb_id="tt1000003")
        self.s_full = Series.objects.create(title="سریال دارای لینک", imdb_id="tt1000004")
        season = Season.objects.create(series=self.s_full, season_number=1)
        episode = Episode.objects.create(season=season, episode_number=1)
        ep_ct = ContentType.objects.get_for_model(Episode)
        Download.objects.create(
            content_type=ep_ct, object_id=episode.id,
            quality="720p", url="https://dl.example.com/ep.mkv",
        )

    def test_bulk_delete_requires_delete_permission(self):
        viewer_only = make_user("vieweronly", is_staff=True)
        role = Group.objects.create(name="فقط مشاهده")
        role.permissions.set(Permission.objects.filter(codename__in=["view_movie"]))
        viewer_only.groups.add(role)
        self.client.force_authenticate(user=viewer_only)
        res = self.client.post("/admin/movies/bulk-delete/", {"ids": [self.m1.id]}, format="json")
        self.assertEqual(res.status_code, 403)
        self.assertTrue(Movie.objects.filter(id=self.m1.id).exists())

    def test_bulk_delete_movies(self):
        self.client.force_authenticate(user=self.deleter)
        res = self.client.post("/admin/movies/bulk-delete/", {"ids": [self.m1.id, self.m2.id]}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["deleted"], 2)
        self.assertEqual(Movie.objects.count(), 0)

    def test_purge_without_downloads_movies(self):
        self.client.force_authenticate(user=self.superadmin)
        count = self.client.get("/admin/movies/without-downloads-count/")
        self.assertEqual(count.data["count"], 1)  # فقط m2
        res = self.client.post("/admin/movies/purge-without-downloads/")
        self.assertEqual(res.data["deleted"], 1)
        self.assertTrue(Movie.objects.filter(id=self.m1.id).exists())
        self.assertFalse(Movie.objects.filter(id=self.m2.id).exists())

    def test_purge_series_keeps_series_with_episode_downloads(self):
        self.client.force_authenticate(user=self.superadmin)
        count = self.client.get("/admin/series/without-downloads-count/")
        self.assertEqual(count.data["count"], 1)  # فقط سریال خالی
        res = self.client.post("/admin/series/purge-without-downloads/")
        self.assertEqual(res.data["deleted"], 1)
        from series.models import Series
        self.assertTrue(Series.objects.filter(id=self.s_full.id).exists())
        self.assertFalse(Series.objects.filter(id=self.s_empty.id).exists())


class AdminMediaRetrieveTest(TestCase):
    """رگرسیون: ویرایش سریال در پنل با NameError: SeriesCast خراب بود."""

    def setUp(self):
        self.client = APIClient()
        self.superadmin = make_user("editor", is_staff=True, is_superuser=True)
        self.client.force_authenticate(user=self.superadmin)

    def test_series_detail_loads_with_cast(self):
        from people.models import Person
        from series.models import Series, SeriesCast

        person = Person.objects.create(tmdb_id="9001", name="بازیگر تست")
        series = Series.objects.create(title="سریال تست", imdb_id="tt9000001")
        SeriesCast.objects.create(
            series=series, person=person, role="actor", character_name="نقش اول"
        )
        res = self.client.get(f"/admin/series/{series.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["title"], "سریال تست")
        self.assertEqual(len(res.data["cast"]), 1)

    def test_movie_detail_loads_with_cast(self):
        from movies.models import MovieCast
        from people.models import Person

        person = Person.objects.create(tmdb_id="9002", name="بازیگر فیلم")
        movie = Movie.objects.create(title="فیلم تست", imdb_id="tt9000002", runtime=95)
        MovieCast.objects.create(
            movie=movie, person=person, role="actor", character_name="قهرمان"
        )
        res = self.client.get(f"/admin/movies/{movie.id}/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data["cast"]), 1)


class AdminSeriesWithoutDownloadsDetectionTest(TestCase):
    """تشخیص «بدون لینک» سریال باید لینک قسمت‌ها و فصل‌ها را هم ببیند."""

    def setUp(self):
        from django.contrib.contenttypes.models import ContentType

        from downloads.models import Download
        from series.models import Episode, Season, Series

        self.Download = Download
        self.Episode = Episode
        self.Season = Season
        self.Series = Series
        self.ct = ContentType.objects.get_for_model

        self.client = APIClient()
        self.client.force_authenticate(
            user=make_user("detector", is_staff=True, is_superuser=True)
        )

    def _series(self, title, imdb):
        return self.Series.objects.create(title=title, imdb_id=imdb)

    def _dl(self, model, obj_id):
        return self.Download.objects.create(
            content_type=self.ct(model), object_id=obj_id,
            quality="720p", url="https://dl.example.com/x.mkv",
        )

    def _preview_titles(self):
        res = self.client.get("/admin/series/without-downloads/")
        self.assertEqual(res.status_code, 200)
        return res.data, [r["title"] for r in res.data["results"]]

    def test_episode_download_in_second_season_counts(self):
        s = self._series("لینک فصل دوم", "tt4000001")
        season1 = self.Season.objects.create(series=s, season_number=1)
        season1.episodes.create(episode_number=1)
        season2 = self.Season.objects.create(series=s, season_number=2)
        ep = season2.episodes.create(episode_number=1)
        self._dl(self.Episode, ep.id)
        _, titles = self._preview_titles()
        self.assertNotIn("لینک فصل دوم", titles)

    def test_season_attached_download_counts(self):
        s = self._series("لینک روی فصل", "tt4000002")
        season = self.Season.objects.create(series=s, season_number=1)
        season.episodes.create(episode_number=1)
        self._dl(self.Season, season.id)
        _, titles = self._preview_titles()
        self.assertNotIn("لینک روی فصل", titles)

    def test_series_with_episodes_but_no_links_is_detected(self):
        s = self._series("قسمت بدون لینک", "tt4000003")
        season = self.Season.objects.create(series=s, season_number=1)
        season.episodes.create(episode_number=1)
        season.episodes.create(episode_number=2)
        data, titles = self._preview_titles()
        self.assertIn("قسمت بدون لینک", titles)
        self.assertEqual(data["count"], 1)
