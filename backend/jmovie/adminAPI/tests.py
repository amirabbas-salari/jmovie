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

    def test_lookup_returns_up_to_5_gallery_images(self):
        self.client.force_authenticate(user=self.superadmin)
        fake_data = {
            "id": 27205, "title": "Inception", "original_title": "Inception",
            "overview": "", "release_date": "2010-07-16", "runtime": 148,
            "vote_average": 8.4, "vote_count": 100,
            "poster_path": "/p.jpg", "backdrop_path": "/b.jpg",
            "production_countries": [], "external_ids": {"imdb_id": "tt1375666"},
            "genres": [], "credits": {"cast": [], "crew": []},
            "images": {
                "backdrops": [
                    {"file_path": f"/bd{i}.jpg", "vote_average": i} for i in range(7)
                ],
                "posters": [{"file_path": "/pp.jpg", "vote_average": 9}],
            },
        }
        with override_settings(TMDB_API_KEY="test-key"), \
                patch("adminAPI.views.TMDBClient") as MockClient:
            MockClient.return_value.movie_full_details.return_value = fake_data
            resp = self.client.get("/admin/tmdb/lookup/", {"type": "movie", "by": "tmdb_id", "value": "27206"})
        self.assertEqual(resp.status_code, 200)
        gallery = resp.data["gallery_images"]
        self.assertEqual(len(gallery), 5)  # سقف ۵ تصویر
        # بهترین امتیاز اول می‌آید (bd6 بالاترین vote_average را دارد)
        self.assertTrue(gallery[0].endswith("/bd6.jpg"))

    def test_lookup_uses_configured_image_base_url(self):
        self.client.force_authenticate(user=self.superadmin)
        fake_data = {
            "id": 27205, "title": "Inception", "original_title": "Inception",
            "overview": "", "release_date": "2010-07-16", "runtime": 148,
            "vote_average": 8.4, "vote_count": 100,
            "poster_path": "/p.jpg", "backdrop_path": "/b.jpg",
            "production_countries": [], "external_ids": {"imdb_id": "tt1375666"},
            "genres": [], "credits": {"cast": [], "crew": []},
            "images": {"backdrops": [{"file_path": "/bd.jpg", "vote_average": 5}]},
        }
        with override_settings(
            TMDB_API_KEY="test-key",
            TMDB_IMAGE_BASE_URL="https://cdn.example.com/t/p/",
        ), patch("adminAPI.views.TMDBClient") as MockClient:
            MockClient.return_value.movie_full_details.return_value = fake_data
            resp = self.client.get("/admin/tmdb/lookup/", {"type": "movie", "by": "tmdb_id", "value": "27207"})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["poster_url"].startswith("https://cdn.example.com/t/p/w500"))
        self.assertEqual(resp.data["gallery_images"], ["https://cdn.example.com/t/p/w1280/bd.jpg"])


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

    def test_without_downloads_preview_movies_shape(self):
        self.client.force_authenticate(user=self.superadmin)
        res = self.client.get("/admin/movies/without-downloads/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 1)  # فقط m2
        self.assertEqual(res.data["results"][0]["title"], "فیلم ۲")
        self.assertIn("year", res.data["results"][0])

    def test_purge_writes_audit_logs(self):
        from adminAPI.models import AdminAuditLog

        self.client.force_authenticate(user=self.superadmin)
        res = self.client.post("/admin/movies/purge-without-downloads/")
        self.assertEqual(res.data["deleted"], 1)
        logs = AdminAuditLog.objects.filter(
            action=AdminAuditLog.ACTION_DELETE, model_label="movies.movie"
        )
        self.assertEqual(logs.count(), 1)
        self.assertEqual(logs.first().object_repr, "فیلم ۲")

    def test_bulk_delete_writes_audit_logs(self):
        from adminAPI.models import AdminAuditLog

        self.client.force_authenticate(user=self.superadmin)
        res = self.client.post(
            "/admin/movies/bulk-delete/",
            {"ids": [self.m1.id, self.m2.id]}, format="json",
        )
        self.assertEqual(res.data["deleted"], 2)
        self.assertEqual(
            AdminAuditLog.objects.filter(
                action=AdminAuditLog.ACTION_DELETE, model_label="movies.movie"
            ).count(),
            2,
        )

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

    def test_preview_year_comes_from_start_date(self):
        import datetime

        self.Series.objects.create(
            title="سریال قدیمی", imdb_id="tt4000004",
            start_date=datetime.date(2021, 5, 1),
        )
        data, _ = self._preview_titles()
        self.assertEqual(data["results"][0]["year"], 2021)


class AdminImportExportTest(TestCase):
    """اکسپورت/ایمپورت JSON فیلم و سریال از پنل مدیریت."""

    def setUp(self):
        from django.contrib.contenttypes.models import ContentType

        from downloads.models import Download
        from series.models import Episode, Series

        self.client = APIClient()
        self.superadmin = make_user("exporter", is_staff=True, is_superuser=True)
        self.movie = Movie.objects.create(
            title="فیلم خروجی", imdb_id="tt8000001", runtime=100,
            poster_url="https://img.example.com/p.jpg",
        )
        self.genre = Genre.objects.create(name="اکشن", slug="action", tmdb_id=28)
        self.movie.genres.add(self.genre)
        from movies.models import MovieGalleryImage

        MovieGalleryImage.objects.create(
            movie=self.movie, image_url="https://img.example.com/g1.jpg", order=0
        )
        Download.objects.create(
            content_type=ContentType.objects.get_for_model(Movie),
            object_id=self.movie.id,
            quality="1080p", url="https://dl.example.com/m.mkv",
        )
        self.series = Series.objects.create(title="سریال خروجی", imdb_id="tt8000002")
        from series.models import Season

        season = Season.objects.create(series=self.series, season_number=1)
        ep = season.episodes.create(episode_number=1, title="قسمت اول")
        Download.objects.create(
            content_type=ContentType.objects.get_for_model(Episode),
            object_id=ep.id, quality="720p", url="https://dl.example.com/ep.mkv",
        )

    def auth(self, user=None):
        self.client.force_authenticate(user=user or self.superadmin)

    # --- خروجی ---
    def test_export_movie_includes_genres_gallery_downloads(self):
        self.auth()
        res = self.client.get("/admin/movies/export/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["type"], "movie")
        self.assertEqual(res.data["count"], 1)
        item = res.data["items"][0]
        self.assertEqual(item["imdb_id"], "tt8000001")
        self.assertEqual(item["genres"][0]["tmdb_id"], 28)
        self.assertEqual(item["gallery"][0]["image_url"], "https://img.example.com/g1.jpg")
        self.assertEqual(item["downloads"][0]["quality"], "1080p")

    def test_export_series_includes_seasons_episodes_downloads(self):
        self.auth()
        res = self.client.get("/admin/series/export/")
        self.assertEqual(res.status_code, 200)
        item = res.data["items"][0]
        self.assertEqual(item["seasons"][0]["season_number"], 1)
        ep = item["seasons"][0]["episodes"][0]
        self.assertEqual(ep["episode_number"], 1)
        self.assertEqual(ep["downloads"][0]["url"], "https://dl.example.com/ep.mkv")

    def test_export_can_filter_by_ids(self):
        self.auth()
        res = self.client.get("/admin/movies/export/", {"ids": "999999"})
        self.assertEqual(res.data["count"], 0)

    # --- ورودی: فیلم ---
    def test_import_creates_movie_with_all_parts(self):
        self.auth()
        payload = {
            "type": "movie",
            "items": [{
                "title": "فیلم وارداتی", "imdb_id": "tt8000010", "runtime": 95,
                "release_date": "2020-01-02",
                "poster_url": "https://img.example.com/new.jpg",
                "genres": [{"name": "درام", "tmdb_id": 18}],
                "cast": [{"tmdb_id": "777", "name": "بازیگر وارداتی", "role": "actor",
                          "character_name": "قهرمان"}],
                "gallery": ["https://img.example.com/a.jpg",
                            {"image_url": "https://img.example.com/b.jpg", "caption": "x"}],
                "downloads": [{"quality": "720p", "url": "https://dl.example.com/n.mkv"}],
            }],
        }
        res = self.client.post("/admin/movies/import/", payload, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual((res.data["created"], res.data["updated"], res.data["skipped"]), (1, 0, 0))
        movie = Movie.objects.get(imdb_id="tt8000010")
        self.assertEqual(movie.title, "فیلم وارداتی")
        self.assertEqual(movie.genres.first().tmdb_id, 18)
        self.assertEqual(movie.movie_cast.first().person.tmdb_id, "777")
        self.assertEqual(movie.gallery.count(), 2)
        self.assertEqual(movie.downloads.count(), 1)

    def test_import_updates_existing_movie_without_duplicate(self):
        self.auth()
        payload = {"items": [{
            "title": "عنوان تازه", "imdb_id": "tt8000001", "runtime": 101,
        }]}
        res = self.client.post("/admin/movies/import/", payload, format="json")
        self.assertEqual((res.data["created"], res.data["updated"]), (0, 1))
        self.assertEqual(Movie.objects.filter(imdb_id="tt8000001").count(), 1)
        self.movie.refresh_from_db()
        self.assertEqual(self.movie.title, "عنوان تازه")
        # downloads در فایل نبوده → دست نخورده باقی می‌ماند
        self.assertEqual(self.movie.downloads.count(), 1)

    def test_import_reports_item_errors_and_continues(self):
        self.auth()
        payload = {"items": [
            {"title": "بدون آیدی", "runtime": 90},  # imdb_id ندارد → خطا
            {"title": "سالم", "imdb_id": "tt8000011", "runtime": 90},
        ]}
        res = self.client.post("/admin/movies/import/", payload, format="json")
        self.assertEqual((res.data["created"], res.data["skipped"]), (1, 1))
        self.assertIn("imdb_id", res.data["errors"][0]["error"])

    def test_import_rejects_malformed_payload(self):
        self.auth()
        res = self.client.post("/admin/movies/import/", {"foo": "bar"}, format="json")
        self.assertEqual(res.status_code, 400)

    # --- ورودی: سریال ---
    def test_import_series_with_seasons_episodes_and_downloads(self):
        self.auth()
        payload = {"items": [{
            "title": "سریال وارداتی", "imdb_id": "tt8000020",
            "seasons": [{
                "season_number": 1,
                "episodes": [
                    {"episode_number": 1, "title": "شروع",
                     "downloads": [{"quality": "1080p", "url": "https://dl.example.com/s1e1.mkv"}]},
                    {"episode_number": 2, "title": "ادامه"},
                ],
            }],
        }]}
        res = self.client.post("/admin/series/import/", payload, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["created"], 1)
        from series.models import Series

        series = Series.objects.get(imdb_id="tt8000020")
        season = series.seasons.get(season_number=1)
        self.assertEqual(season.episodes.count(), 2)
        ep1 = season.episodes.get(episode_number=1)
        self.assertEqual(ep1.downloads.count(), 1)
        # ایمپورت دوباره = به‌روزرسانی، نه تکراری
        res = self.client.post("/admin/series/import/", payload, format="json")
        self.assertEqual(res.data["updated"], 1)
        self.assertEqual(Series.objects.filter(imdb_id="tt8000020").count(), 1)
        self.assertEqual(season.episodes.count(), 2)

    def test_export_import_round_trip_series(self):
        self.auth()
        exported = self.client.get("/admin/series/export/").data
        from series.models import Series

        Series.objects.all().delete()
        res = self.client.post("/admin/series/import/", exported, format="json")
        self.assertEqual(res.data["created"], 1)
        series = Series.objects.get(imdb_id="tt8000002")
        ep = series.seasons.first().episodes.first()
        self.assertEqual(ep.downloads.count(), 1)

    # --- مجوزها ---
    def test_import_requires_add_permission_and_export_view(self):
        viewer = make_user("jsonviewer", is_staff=True)
        role = Group.objects.create(name="مشاهده JSON")
        role.permissions.set(Permission.objects.filter(
            codename__in=["view_movie", "view_series"]
        ))
        viewer.groups.add(role)
        self.auth(viewer)
        self.assertEqual(self.client.get("/admin/movies/export/").status_code, 200)
        res = self.client.post(
            "/admin/movies/import/",
            {"items": [{"title": "x", "imdb_id": "tt8000030", "runtime": 90}]},
            format="json",
        )
        self.assertEqual(res.status_code, 403)
        self.assertFalse(Movie.objects.filter(imdb_id="tt8000030").exists())
