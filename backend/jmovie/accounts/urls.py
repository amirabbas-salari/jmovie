from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from .views import (
    UserRegisterView,
    UserProfileView,
    UserListViewSet,
    UserListItemViewSet,
    MovieUserStatusViewSet,
    SeriesUserStatusViewSet,
    EpisodeWatchStatusViewSet,
    MyListsView,
    MyListIdsView,
    MyListToggleView,
)


router = DefaultRouter()

# User Lists
router.register(
    r"lists",
    UserListViewSet,
    basename="user-lists"
)

router.register(
    r"list-items",
    UserListItemViewSet,
    basename="user-list-items"
)

# Status Tracking
router.register(
    r"movie-statuses",
    MovieUserStatusViewSet,
    basename="movie-user-statuses"
)

router.register(
    r"series-statuses",
    SeriesUserStatusViewSet,
    basename="series-user-statuses"
)

router.register(
    r"episode-statuses",
    EpisodeWatchStatusViewSet,
    basename="episode-watch-statuses"
)


urlpatterns = [
    # ==========================
    # Auth (JWT)
    # ==========================
    path("register/", UserRegisterView.as_view(), name="user-register"),
    # path("auth/login/", TokenObtainPairView.as_view(), name="token-obtain-pair"),
    # path("auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    

    # ==========================
    # Profile
    # ==========================
    path("profile/", UserProfileView.as_view(), name="user-profile"),

    # ==========================
    # My Lists (علاقه‌مندی‌ها / لیست تماشا / دیده‌شده‌ها)
    # ==========================
    path("my-lists/", MyListsView.as_view(), name="my-lists"),
    path("my-lists/ids/", MyListIdsView.as_view(), name="my-lists-ids"),
    path("my-lists/toggle/", MyListToggleView.as_view(), name="my-lists-toggle"),


    # ==========================
    # API (ViewSets)
    # ==========================
    path("", include(router.urls)),
]
