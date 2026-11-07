from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.test import TestCase
from rest_framework.test import APIClient

from genres.models import Genre
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
