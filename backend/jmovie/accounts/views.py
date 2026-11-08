from rest_framework import viewsets, generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.db.models import prefetch_related_objects
from django.shortcuts import get_object_or_404

from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiResponse

from .models import (
    UserList,
    UserListItem,
    MovieUserStatus,
    SeriesUserStatus,
    EpisodeWatchStatus,
)

from .serializers import (
    UserSerializer,
    UserUpdateSerializer,
    UserRegisterSerializer,
    UserListSerializer,
    UserListItemSerializer,
    MovieUserStatusSerializer,
    SeriesUserStatusSerializer,
    EpisodeWatchStatusSerializer,
)

from .permissions import IsOwner, IsListItemOwner

User = get_user_model()


# ==========================
# Auth - Register
# ==========================

@extend_schema(
    tags=["Accounts - Auth"],
    summary="User registration",
)
class UserRegisterView(generics.CreateAPIView):
    serializer_class = UserRegisterSerializer
    permission_classes = [permissions.AllowAny]
    # بدون throttle، این endpoint در معرض ثبت‌نام انبوه خودکار (bot) و
    # brute-force روی یکتایی ایمیل/username بود. scope باید در settings
    # تعریف شود، مثلاً:
    # REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {"register": "5/hour"}
    throttle_classes = [AnonRateThrottle, ScopedRateThrottle]
    throttle_scope = "register"

    @extend_schema(
        summary="ثبت‌نام کاربر جدید",
        description=(
            "ایجاد حساب کاربری جدید توسط کاربر نهایی. نیازی به لاگین ندارد. "
            "در صورت موفقیت، اطلاعات کاربر جدید را برمی‌گرداند."
        ),
        request=UserRegisterSerializer,
        responses={
            201: UserSerializer,
            400: OpenApiResponse(description="اطلاعات واردشده ناقص یا تکراری (مثلاً ایمیل یا نام کاربری تکراری)."),
        },
        tags=["User"],
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


# ==========================
# User Profile (User == Profile)
# ==========================

@extend_schema_view(
    retrieve=extend_schema(
        tags=["Accounts - Profile"],
        summary="Get current user profile",
    ),
    update=extend_schema(
        tags=["Accounts - Profile"],
        summary="Update user profile",
    ),
    partial_update=extend_schema(
        tags=["Accounts - Profile"],
        summary="Partially update user profile",
    ),
)
class UserProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    # تغییر پسورد هم اینجا انجام می‌شود، پس throttle مجزا برای جلوگیری از
    # brute-force روی old_password لازم است.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "profile_update"

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return UserUpdateSerializer
        return UserSerializer

    def get_object(self):
        return self.request.user

    # متد update سفارشی قبلی حذف شد. مشکلاتش:
    #   1) print(serializer.errors) دیباگ در کد production باقی مانده بود
    #      و می‌توانست داده‌ی حساس کاربر را در stdout/لاگ سرور بریزد.
    #   2) serializer.is_valid() دو بار صدا زده می‌شد (یک‌بار بی‌فایده).
    #   3) partial=True به‌صورت hardcode ست شده بود، یعنی درخواست PUT هم
    #      رفتار PATCH می‌گرفت؛ در حالی که RetrieveUpdateAPIView به‌صورت
    #      پیش‌فرض partial بودن را از روی متد HTTP (PUT vs PATCH) تشخیص
    #      می‌دهد و این override اصلاً لازم نبود.
    # اگر نیاز واقعی این است که PUT هم همیشه partial رفتار کند (مثلاً چون
    # کلاینت فقط فیلدهای تغییریافته را می‌فرستد)، از get_serializer به‌جای
    # override کردن update استفاده کنید:
    #
    # def get_serializer(self, *args, **kwargs):
    #     kwargs["partial"] = True
    #     return super().get_serializer(*args, **kwargs)


# ==========================
# User Lists
# ==========================

@extend_schema_view(
    list=extend_schema(
        tags=["Accounts - Lists"],
        summary="List user lists",
    ),
    create=extend_schema(
        tags=["Accounts - Lists"],
        summary="Create new user list",
    ),
)
class UserListViewSet(viewsets.ModelViewSet):
    serializer_class = UserListSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        return UserList.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


@extend_schema_view(
    list=extend_schema(
        tags=["Accounts - Lists"],
        summary="List items in a user list",
    ),
    create=extend_schema(
        tags=["Accounts - Lists"],
        summary="Add item to user list",
    ),
    destroy=extend_schema(
        tags=["Accounts - Lists"],
        summary="Remove item from user list",
    ),
)
class UserListItemViewSet(viewsets.ModelViewSet):
    """
    این ویوست به‌صورت nested زیر یک UserList مشخص در نظر گرفته شده است،
    یعنی URLconf باید چیزی شبیه این باشد (با drf-nested-routers یا مشابه):

        /lists/<list_pk>/items/

    اگر ساختار URL شما فرق دارد، فقط کافی است نام kwarg را در دو متد زیر
    مطابقت دهید. نکته‌ی امنیتی مهم: user_list از URL گرفته می‌شود، نه از
    بدنه‌ی درخواست، و علاوه بر آن مالکیت آن لیست هم چک می‌شود؛ در غیر این
    صورت کاربر می‌توانست آیتمی به لیستِ کاربر دیگری اضافه کند.
    """
    serializer_class = UserListItemSerializer
    permission_classes = [permissions.IsAuthenticated, IsListItemOwner]

    def get_queryset(self):
        return UserListItem.objects.filter(
            user_list__user=self.request.user
        )

    def _get_owned_user_list(self):
        list_pk = self.kwargs.get("list_pk")
        try:
            return UserList.objects.get(pk=list_pk, user=self.request.user)
        except UserList.DoesNotExist:
            raise PermissionDenied("این لیست متعلق به شما نیست یا وجود ندارد.")

    def perform_create(self, serializer):
        user_list = self._get_owned_user_list()
        serializer.save(user_list=user_list)


# ==========================
# My Lists (علاقه‌مندی‌ها / لیست تماشا / دیده‌شده‌ها)
# ==========================
# این سه API روی همان مدل‌های MovieUserStatus/SeriesUserStatus ساخته
# شده‌اند و چیزی است که فرانت‌اند واقعاً مصرف می‌کند:
#   GET  /accounts/my-lists/        → آیتم‌های هر سه لیست با جزئیات مدیا
#   GET  /accounts/my-lists/ids/    → فقط idها (برای تیک دکمه‌های کارت‌ها)
#   POST /accounts/my-lists/toggle/ → افزودن/حذف یک آیتم از یک لیست

LIST_STATUS_MAP = {
    "favorite": MovieUserStatus.STATUS_FAVORITE,
    "watchlist": MovieUserStatus.STATUS_WATCH_LATER,
    "watched": MovieUserStatus.STATUS_WATCHED,
}


def _status_models(media_type):
    from movies.models import Movie
    from series.models import Series

    if media_type == "movie":
        return MovieUserStatus, Movie, "movie"
    if media_type == "series":
        return SeriesUserStatus, Series, "series"
    raise ValidationError({"media_type": "نوع مدیا باید movie یا series باشد."})


def _serialize_status_items(status_qs, media_field, serializer_cls):
    """رکوردهای وضعیت را به [{media_type, added_at, media}] تبدیل می‌کند."""
    items = list(status_qs)
    media_objects = [getattr(item, media_field) for item in items]
    if media_objects:
        prefetch_related_objects(media_objects, "genres")
    serialized = serializer_cls(media_objects, many=True).data
    by_id = {media["id"]: media for media in serialized}
    return [
        {
            "media_type": media_field,
            "added_at": item.created_at,
            "media": by_id.get(getattr(item, f"{media_field}_id")),
        }
        for item in items
    ]


class MyListsView(APIView):
    """هر سه لیست کاربر با جزئیات کامل مدیا، جدیدترین اول."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from movies.serializers import MovieListSerializer
        from series.serializers import SeriesListSerializer

        result = {}
        for list_name, status_value in LIST_STATUS_MAP.items():
            movie_items = _serialize_status_items(
                MovieUserStatus.objects.filter(
                    user=request.user, status=status_value
                )
                .select_related("movie")
                .order_by("-created_at"),
                "movie",
                MovieListSerializer,
            )
            series_items = _serialize_status_items(
                SeriesUserStatus.objects.filter(
                    user=request.user, status=status_value
                )
                .select_related("series")
                .order_by("-created_at"),
                "series",
                SeriesListSerializer,
            )
            merged = movie_items + series_items
            merged.sort(key=lambda x: x["added_at"], reverse=True)
            result[list_name] = merged
        return Response(result)


class MyListIdsView(APIView):
    """فقط idهای هر لیست؛ سبک، برای این‌که کارت‌ها بدانند تیک خورده‌اند یا نه."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        result = {}
        for list_name, status_value in LIST_STATUS_MAP.items():
            result[list_name] = {
                "movie": list(
                    MovieUserStatus.objects.filter(
                        user=request.user, status=status_value
                    ).values_list("movie_id", flat=True)
                ),
                "series": list(
                    SeriesUserStatus.objects.filter(
                        user=request.user, status=status_value
                    ).values_list("series_id", flat=True)
                ),
            }
        return Response(result)


class MyListToggleView(APIView):
    """افزودن/حذف یک فیلم یا سریال از یکی از لیست‌های کاربر (toggle)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        media_type = request.data.get("media_type")
        list_name = request.data.get("list")
        media_id = request.data.get("media_id")

        if list_name not in LIST_STATUS_MAP:
            raise ValidationError(
                {"list": "لیست باید favorite، watchlist یا watched باشد."}
            )
        if media_id is None:
            raise ValidationError({"media_id": "شناسه‌ی مدیا الزامی است."})

        status_model, media_model, fk_field = _status_models(media_type)
        media_obj = get_object_or_404(media_model, pk=media_id)
        status_value = LIST_STATUS_MAP[list_name]

        existing = status_model.objects.filter(
            user=request.user, status=status_value, **{fk_field: media_obj}
        ).first()
        if existing is not None:
            existing.delete()
            active = False
        else:
            status_model.objects.create(
                user=request.user, status=status_value, **{fk_field: media_obj}
            )
            active = True

        return Response(
            {
                "media_type": media_type,
                "media_id": media_obj.pk,
                "list": list_name,
                "active": active,
            },
            status=status.HTTP_200_OK,
        )


# ==========================
# Movie User Status
# ==========================

@extend_schema_view(
    list=extend_schema(
        tags=["Accounts - Status"],
        summary="List movie user statuses",
    ),
    create=extend_schema(
        tags=["Accounts - Status"],
        summary="Create movie user status",
    ),
)
class MovieUserStatusViewSet(viewsets.ModelViewSet):
    serializer_class = MovieUserStatusSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        return MovieUserStatus.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# ==========================
# Series User Status
# ==========================

@extend_schema_view(
    list=extend_schema(
        tags=["Accounts - Status"],
        summary="List series user statuses",
    ),
    create=extend_schema(
        tags=["Accounts - Status"],
        summary="Create series user status",
    ),
)
class SeriesUserStatusViewSet(viewsets.ModelViewSet):
    serializer_class = SeriesUserStatusSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        return SeriesUserStatus.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# ==========================
# Episode Watch Status
# ==========================

@extend_schema_view(
    list=extend_schema(
        tags=["Accounts - Status"],
        summary="List episode watch statuses",
    ),
    create=extend_schema(
        tags=["Accounts - Status"],
        summary="Create episode watch status",
    ),
)
class EpisodeWatchStatusViewSet(viewsets.ModelViewSet):
    serializer_class = EpisodeWatchStatusSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]

    def get_queryset(self):
        return EpisodeWatchStatus.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)