from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.db.models import Count, Prefetch, Sum
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from collection.models import Collection, CollectionItem
from comments.models import Comment
from downloads.models import Download
from genres.models import Genre
from movies.models import Movie, MovieCast
from people.models import Person
from series.models import Episode, Season, Series

from .models import AdminAuditLog
from .permissions import HasModelPermission, IsStaffMember, IsSuperAdmin
from .serializers import (
    AdminAuditLogSerializer,
    AdminCollectionListSerializer,
    AdminCollectionSerializer,
    AdminCollectionItemSerializer,
    AdminCommentSerializer,
    AdminDownloadSerializer,
    AdminEpisodeSerializer,
    AdminGenreSerializer,
    AdminMeSerializer,
    AdminMovieListSerializer,
    AdminMovieSerializer,
    AdminPersonListSerializer,
    AdminPersonSerializer,
    AdminRoleSerializer,
    AdminSeasonSerializer,
    AdminSeriesListSerializer,
    AdminSeriesSerializer,
    AdminUserSerializer,
    PermissionCatalogSerializer,
)

User = get_user_model()


def _client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


class AuditMixin:
    """ثبت خودکار ایجاد/ویرایش/حذف در لاگ فعالیت ادمین."""

    def _log(self, request, action_name, instance):
        try:
            changes = {}
            if action_name in ("create", "update"):
                for key, value in request.data.items():
                    if hasattr(value, "name"):  # فایل آپلودی
                        continue
                    text = str(value)
                    changes[key] = text[:500]
            AdminAuditLog.objects.create(
                user=request.user if request.user.is_authenticated else None,
                username=getattr(request.user, "username", ""),
                action=action_name,
                model_label=instance._meta.label_lower,
                object_id=str(instance.pk),
                object_repr=str(instance)[:255],
                changes=changes,
                ip_address=_client_ip(request),
            )
        except Exception:
            pass  # لاگ نباید جلوی عملیات اصلی را بگیرد

    def perform_create(self, serializer):
        instance = serializer.save()
        self._log(self.request, AdminAuditLog.ACTION_CREATE, instance)

    def perform_update(self, serializer):
        instance = serializer.save()
        self._log(self.request, AdminAuditLog.ACTION_UPDATE, instance)

    def perform_destroy(self, instance):
        self._log(self.request, AdminAuditLog.ACTION_DELETE, instance)
        super().perform_destroy(instance)


from rest_framework.pagination import PageNumberPagination  # noqa: E402


class AdminPageNumberPagination(PageNumberPagination):
    page_size = 24
    page_size_query_param = "page_size"
    max_page_size = 100


class AdminModelViewSet(AuditMixin, viewsets.ModelViewSet):
    """پایه‌ی همه‌ی ویوست‌های پنل: مجوز ریزدانه بر اساس مدل + آپلود فایل."""
    permission_classes = [HasModelPermission]
    pagination_class = AdminPageNumberPagination
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    lookup_field = "id"

    def get_serializer_class(self):
        list_serializer = getattr(self, "list_serializer_class", None)
        if self.action == "list" and list_serializer is not None:
            return list_serializer
        return super().get_serializer_class()


# ---------------------------------------------------------------------------
# Me / Dashboard / Permissions catalog
# ---------------------------------------------------------------------------
class AdminMeView(APIView):
    """اطلاعات ادمین جاری + نقش‌ها و مجوزهای مؤثر (برای گارد فرانت‌اند)."""
    permission_classes = [IsStaffMember]

    def get(self, request):
        return Response(AdminMeSerializer(request.user, context={"request": request}).data)


class AdminPermissionCatalogView(APIView):
    """فهرست همه‌ی مجوزهای قابل واگذاری — فقط سوپرادمین (صفحه‌ی ساخت نقش)."""
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        admin_apps = ["movies", "series", "genres", "people", "collection",
                      "downloads", "comments", "accounts", "adminAPI"]
        perms = (
            Permission.objects.select_related("content_type")
            .filter(content_type__app_label__in=admin_apps)
            .order_by("content_type__app_label", "content_type__model", "codename")
        )
        return Response(PermissionCatalogSerializer(perms, many=True).data)


class AdminDashboardView(APIView):
    """
    داشبورد در «یک» درخواست: قبلاً فرانت ۴ لیست کامل را می‌گرفت تا فقط
    count نشان دهد. اینجا همه‌چیز با کوئری‌های aggregate سبک شمرده می‌شود.
    """
    permission_classes = [IsStaffMember]

    def get(self, request):
        latest_movies = Movie.objects.order_by("-created_at")[:5]
        latest_series = Series.objects.order_by("-created_at")[:5]
        pending_comments = (
            Comment.objects.filter(is_approved=False, is_active=True)
            .select_related("user").order_by("-created_at")[:5]
        )
        data = {
            "stats": {
                "movies": Movie.objects.count(),
                "series": Series.objects.count(),
                "episodes": Episode.objects.count(),
                "people": Person.objects.count(),
                "genres": Genre.objects.count(),
                "collections": Collection.objects.count(),
                "downloads": Download.objects.filter(is_active=True).count(),
                "users": User.objects.count(),
                "staff_users": User.objects.filter(is_staff=True).count(),
                "vip_users": User.objects.filter(is_vip=True).count(),
                "comments_total": Comment.objects.count(),
                "comments_pending": Comment.objects.filter(is_approved=False, is_active=True).count(),
                "total_views": (Movie.objects.aggregate(v=Sum("views"))["v"] or 0)
                               + (Series.objects.aggregate(v=Sum("views"))["v"] or 0),
            },
            "latest_movies": AdminMovieListSerializer(latest_movies, many=True, context={"request": request}).data,
            "latest_series": AdminSeriesListSerializer(latest_series, many=True, context={"request": request}).data,
            "pending_comments": AdminCommentSerializer(pending_comments, many=True, context={"request": request}).data,
            "recent_activity": AdminAuditLogSerializer(AdminAuditLog.objects.all()[:8], many=True).data,
        }
        return Response(data)


# ---------------------------------------------------------------------------
# Content viewsets
# ---------------------------------------------------------------------------
class AdminMovieViewSet(AdminModelViewSet):
    queryset = Movie.objects.all().order_by("-updated_at")
    serializer_class = AdminMovieSerializer
    list_serializer_class = AdminMovieListSerializer
    search_fields = ["title", "original_title", "imdb_id", "tmdb_id"]
    ordering_fields = ["id", "release_date", "imdb_rating", "views", "created_at", "updated_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == "list":
            # لیست سبک: فقط ژانرها؛ بدون عوامل/دانلود/کامنت (N+1 و حجم پاسخ)
            qs = qs.prefetch_related("genres").only(
                "id", "title", "original_title", "slug", "year", "release_date",
                "imdb_rating", "imdb_id", "tmdb_id", "views", "is_active",
                "poster", "poster_url", "updated_at",
            )
        elif self.action == "retrieve":
            qs = qs.prefetch_related(
                "genres", "gallery", "downloads",
                Prefetch("movie_cast", queryset=MovieCast.objects.select_related("person").order_by("id")),
            )
        is_active = self.request.query_params.get("is_active")
        if is_active in ("true", "false"):
            qs = qs.filter(is_active=is_active == "true")
        return qs


class AdminSeriesViewSet(AdminModelViewSet):
    queryset = Series.objects.all().order_by("-updated_at")
    serializer_class = AdminSeriesSerializer
    list_serializer_class = AdminSeriesListSerializer
    search_fields = ["title", "original_title", "imdb_id", "tmdb_id"]
    ordering_fields = ["id", "start_date", "imdb_rating", "views", "created_at", "updated_at"]

    def get_queryset(self):
        qs = super().get_queryset().prefetch_related("genres")
        if self.action == "list":
            qs = qs.annotate(seasons_count=Count("seasons", distinct=True))
        elif self.action == "retrieve":
            qs = qs.prefetch_related("gallery", "downloads", "seasons",
                                     Prefetch("cast", queryset=SeriesCast.objects.select_related("person").order_by("id")))
        is_ended = self.request.query_params.get("is_ended")
        if is_ended in ("true", "false"):
            qs = qs.filter(is_ended=is_ended == "true")
        return qs


class AdminSeasonViewSet(AdminModelViewSet):
    queryset = Season.objects.select_related("series").order_by("season_number")
    serializer_class = AdminSeasonSerializer
    search_fields = ["title", "series__title"]
    ordering_fields = ["id", "season_number", "release_date", "created_at"]

    def get_queryset(self):
        qs = super().get_queryset().annotate(episodes_count=Count("episodes", distinct=True))
        series_id = self.request.query_params.get("series")
        if series_id:
            qs = qs.filter(series_id=series_id)
        return qs


class AdminEpisodeViewSet(AdminModelViewSet):
    queryset = Episode.objects.select_related("season", "season__series").order_by("episode_number")
    serializer_class = AdminEpisodeSerializer
    search_fields = ["title", "season__series__title"]
    ordering_fields = ["id", "episode_number", "air_date", "vote_average", "created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action == "retrieve":
            qs = qs.prefetch_related("downloads")
        season_id = self.request.query_params.get("season")
        if season_id:
            qs = qs.filter(season_id=season_id)
        series_id = self.request.query_params.get("series")
        if series_id:
            qs = qs.filter(season__series_id=series_id)
        return qs


class AdminPersonViewSet(AdminModelViewSet):
    queryset = Person.objects.all().order_by("-popularity", "name")
    serializer_class = AdminPersonSerializer
    list_serializer_class = AdminPersonListSerializer
    search_fields = ["name", "original_name", "tmdb_id", "slug"]
    ordering_fields = ["id", "name", "popularity", "birth_date", "created_at"]


class AdminGenreViewSet(AdminModelViewSet):
    queryset = Genre.objects.all().order_by("name")
    serializer_class = AdminGenreSerializer
    search_fields = ["name", "slug"]
    ordering_fields = ["id", "name", "created_at"]

    def get_queryset(self):
        return super().get_queryset().annotate(
            movies_count=Count("movies", distinct=True),
            series_count=Count("series", distinct=True),
        )


class AdminCollectionViewSet(AdminModelViewSet):
    queryset = Collection.objects.all().order_by("order", "title")
    serializer_class = AdminCollectionSerializer
    list_serializer_class = AdminCollectionListSerializer
    search_fields = ["title", "slug"]
    ordering_fields = ["id", "title", "order", "created_at"]

    def get_queryset(self):
        qs = super().get_queryset().annotate(items_count=Count("items", distinct=True))
        if self.action == "retrieve":
            qs = qs.prefetch_related("items__content_type")
        return qs


class AdminCollectionItemViewSet(AdminModelViewSet):
    queryset = CollectionItem.objects.select_related("collection", "content_type").order_by("order", "id")
    serializer_class = AdminCollectionItemSerializer
    ordering_fields = ["id", "order"]

    def get_queryset(self):
        qs = super().get_queryset()
        collection_id = self.request.query_params.get("collection")
        if collection_id:
            qs = qs.filter(collection_id=collection_id)
        return qs


class AdminDownloadViewSet(AdminModelViewSet):
    queryset = Download.objects.select_related("content_type").order_by("-created_at")
    serializer_class = AdminDownloadSerializer
    search_fields = ["title", "quality", "language", "url"]
    ordering_fields = ["id", "created_at", "quality"]

    def get_queryset(self):
        qs = super().get_queryset()
        target_type = self.request.query_params.get("target_type")
        object_id = self.request.query_params.get("object_id")
        if target_type:
            try:
                ct = ContentType.objects.get(model=target_type.lower())
            except ContentType.DoesNotExist:
                return qs.none()
            qs = qs.filter(content_type=ct)
            if object_id:
                qs = qs.filter(object_id=object_id)
        is_active = self.request.query_params.get("is_active")
        if is_active in ("true", "false"):
            qs = qs.filter(is_active=is_active == "true")
        return qs


class AdminCommentViewSet(AdminModelViewSet):
    queryset = Comment.objects.select_related("user", "content_type").order_by("-created_at")
    serializer_class = AdminCommentSerializer
    search_fields = ["text", "user__username"]
    ordering_fields = ["id", "created_at"]
    extra_action_permissions = {
        "approve": "comments.change_comment",
        "reject": "comments.change_comment",
    }

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get("status")
        if status_param == "pending":
            qs = qs.filter(is_approved=False, is_active=True)
        elif status_param == "approved":
            qs = qs.filter(is_approved=True)
        elif status_param == "inactive":
            qs = qs.filter(is_active=False)
        return qs

    @action(detail=True, methods=["post"])
    def approve(self, request, id=None):
        comment = self.get_object()
        comment.is_approved = True
        comment.is_active = True
        comment.save(update_fields=["is_approved", "is_active", "updated_at"])
        self._log(request, AdminAuditLog.ACTION_UPDATE, comment)
        return Response(self.get_serializer(comment).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, id=None):
        comment = self.get_object()
        comment.is_approved = False
        comment.is_active = False
        comment.save(update_fields=["is_approved", "is_active", "updated_at"])
        self._log(request, AdminAuditLog.ACTION_UPDATE, comment)
        return Response(self.get_serializer(comment).data)


# ---------------------------------------------------------------------------
# Users & Roles (سطح دسترسی)
# ---------------------------------------------------------------------------
class AdminUserViewSet(AdminModelViewSet):
    queryset = User.objects.prefetch_related("groups", "user_permissions").order_by("-date_joined")
    serializer_class = AdminUserSerializer
    search_fields = ["username", "email", "first_name", "last_name", "phone"]
    ordering_fields = ["id", "date_joined", "last_login", "username", "email"]
    extra_action_permissions = {
        "toggle_active": "accounts.change_user",
        "assign_roles": "auth.change_group",
    }

    def get_queryset(self):
        qs = super().get_queryset()
        role = self.request.query_params.get("role")  # staff | vip | superuser | user
        if role == "staff":
            qs = qs.filter(is_staff=True, is_superuser=False)
        elif role == "superuser":
            qs = qs.filter(is_superuser=True)
        elif role == "vip":
            qs = qs.filter(is_vip=True)
        elif role == "user":
            qs = qs.filter(is_staff=False, is_superuser=False)
        is_active = self.request.query_params.get("is_active")
        if is_active in ("true", "false"):
            qs = qs.filter(is_active=is_active == "true")
        return qs

    def perform_destroy(self, instance):
        if instance == self.request.user:
            raise PermissionDenied("نمی‌توانید حساب خودتان را حذف کنید.")
        if instance.is_superuser and not self.request.user.is_superuser:
            raise PermissionDenied("حذف سوپرادمین فقط توسط سوپرادمین مجاز است.")
        super().perform_destroy(instance)

    @action(detail=True, methods=["post"])
    def toggle_active(self, request, id=None):
        target = self.get_object()
        if target == request.user:
            raise PermissionDenied("نمی‌توانید حساب خودتان را غیرفعال کنید.")
        if target.is_superuser and not request.user.is_superuser:
            raise PermissionDenied("تغییر وضعیت سوپرادمین فقط توسط سوپرادمین مجاز است.")
        target.is_active = not target.is_active
        target.save(update_fields=["is_active"])
        self._log(request, AdminAuditLog.ACTION_UPDATE, target)
        return Response(self.get_serializer(target).data)

    @action(detail=True, methods=["post"])
    def assign_roles(self, request, id=None):
        """تعیین نقش‌های یک ادمین — فقط سوپرادمین."""
        if not request.user.is_superuser:
            raise PermissionDenied("تعیین سطح دسترسی فقط توسط سوپرادمین انجام می‌شود.")
        target = self.get_object()
        role_ids = request.data.get("role_ids", [])
        if not isinstance(role_ids, list):
            return Response({"role_ids": "باید لیستی از آیدی نقش‌ها باشد."},
                            status=status.HTTP_400_BAD_REQUEST)
        target.groups.set(Group.objects.filter(id__in=role_ids))
        if not target.is_superuser:
            # داشتن نقش بدون is_staff یعنی کاربر عملاً وارد پنل نمی‌شود.
            target.is_staff = True
            target.save(update_fields=["is_staff"])
        self._log(request, AdminAuditLog.ACTION_UPDATE, target)
        return Response(self.get_serializer(target).data)


class AdminRoleViewSet(AuditMixin, viewsets.ModelViewSet):
    """مدیریت نقش‌ها — ساخت/ویرایش/حذف و تعیین مجوز هر نقش فقط با سوپرادمین."""
    queryset = Group.objects.prefetch_related("permissions__content_type", "user_set").order_by("id")
    serializer_class = AdminRoleSerializer
    permission_classes = [IsSuperAdmin]
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    lookup_field = "id"


class AdminAuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AdminAuditLog.objects.select_related("user").order_by("-created_at")
    serializer_class = AdminAuditLogSerializer
    permission_classes = [IsSuperAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["username", "model_label", "object_repr"]
    ordering_fields = ["id", "created_at"]
    lookup_field = "id"
