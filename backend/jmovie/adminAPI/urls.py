from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminAuditLogViewSet,
    AdminCollectionItemViewSet,
    AdminCollectionViewSet,
    AdminCommentViewSet,
    AdminDashboardView,
    AdminDownloadViewSet,
    AdminEpisodeViewSet,
    AdminGenreViewSet,
    AdminMeView,
    AdminMovieViewSet,
    AdminPermissionCatalogView,
    AdminPersonViewSet,
    AdminRoleViewSet,
    AdminSeasonViewSet,
    AdminSeriesViewSet,
    AdminUserViewSet,
    TmdbLookupView,
)

router = DefaultRouter()
router.register("movies", AdminMovieViewSet, basename="admin-movies")
router.register("series", AdminSeriesViewSet, basename="admin-series")
router.register("seasons", AdminSeasonViewSet, basename="admin-seasons")
router.register("episodes", AdminEpisodeViewSet, basename="admin-episodes")
router.register("people", AdminPersonViewSet, basename="admin-people")
router.register("genres", AdminGenreViewSet, basename="admin-genres")
router.register("collections", AdminCollectionViewSet, basename="admin-collections")
router.register("collection-items", AdminCollectionItemViewSet, basename="admin-collection-items")
router.register("downloads", AdminDownloadViewSet, basename="admin-downloads")
router.register("comments", AdminCommentViewSet, basename="admin-comments")
router.register("users", AdminUserViewSet, basename="admin-users")
router.register("roles", AdminRoleViewSet, basename="admin-roles")
router.register("audit-logs", AdminAuditLogViewSet, basename="admin-audit-logs")

urlpatterns = [
    path("me/", AdminMeView.as_view(), name="admin-me"),
    path("dashboard/", AdminDashboardView.as_view(), name="admin-dashboard"),
    path("permissions/", AdminPermissionCatalogView.as_view(), name="admin-permissions"),
    path("tmdb/lookup/", TmdbLookupView.as_view(), name="admin-tmdb-lookup"),
] + router.urls
