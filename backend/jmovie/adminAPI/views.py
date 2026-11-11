from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
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
from series.models import Episode, Season, Series, SeriesCast

from movies.services.tmdb import TMDBClient

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
                      "downloads", "comments", "accounts", "adminAPI", "content_agent"]
        perms = (
            Permission.objects.select_related("content_type")
            .filter(content_type__app_label__in=admin_apps)
            .order_by("content_type__app_label", "content_type__model", "codename")
        )
        return Response(PermissionCatalogSerializer(perms, many=True).data)


class AdminDashboardView(APIView):
    @staticmethod
    def _recent_activity():
        # اگر مایگریشن adminAPI هنوز روی دیتابیس اجرا نشده باشد (جدول لاگ
        # وجود نداشته باشد) داشبورد نباید کامل از کار بیفتد.
        try:
            logs = AdminAuditLog.objects.all()[:8]
            return AdminAuditLogSerializer(logs, many=True).data
        except Exception:
            return []

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
            "recent_activity": self._recent_activity(),
        }
        return Response(data)




TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/"


def _tmdb_img(path, size):
    return f"{TMDB_IMAGE_BASE}{size}{path}" if path else ""


class TmdbLookupView(APIView):
    """
    دریافت خودکار اطلاعات از TMDB برای فرم فیلم/سریال پنل.

    GET /admin/tmdb/lookup/?type=movie|series&by=imdb_id|tmdb_id&value=tt0816692
    پاسخ نرمال‌شده برمی‌گرداند + مشخص می‌کند کدام ژانرها/افراد از قبل در
    دیتابیس لوکال هستند (local_id) تا فرانت بقیه را در صورت نیاز بسازد.
    نتیجه ۲۴ ساعت کش می‌شود تا هم سریع باشد هم سقف TMDB مصرف نشود.
    """
    permission_classes = [IsStaffMember]

    def get(self, request):
        if not settings.TMDB_API_KEY:
            return Response(
                {"detail": "کلید TMDB_API_KEY در سرور تنظیم نشده است."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        media_type = request.query_params.get("type", "movie")
        by = request.query_params.get("by", "imdb_id")
        value = (request.query_params.get("value") or "").strip()
        if media_type not in ("movie", "series") or by not in ("imdb_id", "tmdb_id") or not value:
            return Response({"detail": "پارامترهای type/by/value معتبر نیستند."},
                            status=status.HTTP_400_BAD_REQUEST)

        cache_key = f"tmdb-lookup:{media_type}:{by}:{value}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        client = TMDBClient()
        try:
            if by == "imdb_id":
                tmdb_id = client.find_movie(value) if media_type == "movie" else client.find_tv(value)
                if not tmdb_id:
                    return Response({"detail": "با این IMDb ID چیزی در TMDB پیدا نشد."},
                                    status=status.HTTP_404_NOT_FOUND)
            else:
                tmdb_id = int(value)
            data = (client.movie_full_details(tmdb_id) if media_type == "movie"
                    else client.tv_full_details(tmdb_id))
        except (ValueError, TypeError):
            return Response({"detail": "TMDB ID باید عدد باشد."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({"detail": "ارتباط با TMDB برقرار نشد؛ دوباره تلاش کنید."},
                            status=status.HTTP_502_BAD_GATEWAY)

        payload = self._normalize(media_type, data)
        cache.set(cache_key, payload, 60 * 60 * 24)
        return Response(payload)

    @staticmethod
    def _normalize(media_type, data):
        is_movie = media_type == "movie"
        credits = data.get("credits") or {}
        cast_items = []
        seen = set()

        def _person_item(person, role, character=""):
            key = (person.get("id"), role)
            if not person.get("id") or key in seen:
                return
            seen.add(key)
            local = Person.objects.filter(tmdb_id=str(person["id"])).first()
            cast_items.append({
                "tmdb_id": str(person["id"]),
                "name": person.get("name") or "",
                "role": role,
                "character_name": character or "",
                "profile_image_url": _tmdb_img(person.get("profile_path"), "w185"),
                "local_id": local.id if local else None,
            })

        for member in (credits.get("cast") or [])[:12]:
            _person_item(member, "actor", member.get("character") or "")
        for member in credits.get("crew") or []:
            if member.get("job") == "Director":
                _person_item(member, "director")
            elif member.get("department") == "Writing" and member.get("job") in ("Writer", "Screenplay", "Novel"):
                _person_item(member, "writer")

        genre_items = []
        for genre in data.get("genres") or []:
            local = Genre.objects.filter(tmdb_id=genre.get("id")).first()
            genre_items.append({
                "tmdb_id": genre.get("id"),
                "name": genre.get("name") or "",
                "local_id": local.id if local else None,
            })

        countries = data.get("production_countries") or []
        runtime = data.get("runtime")
        if not is_movie:
            run_times = data.get("episode_run_time") or []
            runtime = run_times[0] if run_times else None

        return {
            "type": media_type,
            "tmdb_id": data.get("id"),
            "imdb_id": (data.get("external_ids") or {}).get("imdb_id") or data.get("imdb_id") or "",
            "title": (data.get("title") if is_movie else data.get("name")) or "",
            "original_title": (data.get("original_title") if is_movie else data.get("original_name")) or "",
            "description": data.get("overview") or "",
            "release_date": (data.get("release_date") if is_movie else data.get("first_air_date")) or "",
            "start_date": "" if is_movie else (data.get("first_air_date") or ""),
            "end_date": "" if is_movie else (data.get("last_air_date") or ""),
            "runtime": runtime,
            "imdb_rating": round(float(data["vote_average"]), 1) if data.get("vote_average") else None,
            "imdb_votes": data.get("vote_count") or 0,
            "poster_url": _tmdb_img(data.get("poster_path"), "w500"),
            "backdrop_url": _tmdb_img(data.get("backdrop_path"), "w1280"),
            "country": countries[0].get("name", "") if countries else "",
            "number_of_seasons": data.get("number_of_seasons"),
            "number_of_episodes": data.get("number_of_episodes"),
            "is_ended": (data.get("status") == "Ended") if not is_movie else None,
            "genres": genre_items,
            "cast": cast_items,
        }


# ---------------------------------------------------------------------------
# Content viewsets
# ---------------------------------------------------------------------------
class MediaBulkActionsMixin:
    """حذف گروهی و پاکسازی «بدون لینک دانلود» برای فیلم/سریال.

    برای سریال، دانلودهای قسمت‌ها (از مسیر فصل‌ها) هم حساب می‌شوند تا
    سریالی که قسمت‌هایش لینک دارند اشتباهی «بدون لینک» تشخیص داده نشود.
    """

    media_is_series = False

    def _without_downloads_qs(self):
        qs = self.get_queryset() if hasattr(self, "get_queryset") else self.queryset
        qs = qs.annotate(_dl_count=Count("downloads", distinct=True))
        if self.media_is_series:
            qs = qs.annotate(
                _ep_dl_count=Count("seasons__episodes__downloads", distinct=True)
            ).filter(_dl_count=0, _ep_dl_count=0)
        else:
            qs = qs.filter(_dl_count=0)
        return qs

    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete(self, request):
        ids = request.data.get("ids")
        if not isinstance(ids, list) or not ids:
            return Response(
                {"ids": "فهرست آیدی‌ها (ids) لازم است."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        qs = self.queryset.filter(id__in=ids)
        items = list(qs)
        for item in items:
            self._log(request, AdminAuditLog.ACTION_DELETE, item)
        qs.delete()
        return Response({"deleted": len(items)})

    @action(detail=False, methods=["get"], url_path="without-downloads-count")
    def without_downloads_count(self, request):
        return Response({"count": self._without_downloads_qs().count()})

    @action(detail=False, methods=["post"], url_path="purge-without-downloads")
    def purge_without_downloads(self, request):
        qs = self._without_downloads_qs()
        items = list(qs)
        for item in items:
            self._log(request, AdminAuditLog.ACTION_DELETE, item)
        qs.delete()
        return Response({"deleted": len(items)})


class AdminMovieViewSet(MediaBulkActionsMixin, AdminModelViewSet):
    extra_action_permissions = {
        "bulk_delete": "movies.delete_movie",
        "purge_without_downloads": "movies.delete_movie",
        "without_downloads_count": "movies.view_movie",
    }
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


class AdminSeriesViewSet(MediaBulkActionsMixin, AdminModelViewSet):
    media_is_series = True
    extra_action_permissions = {
        "bulk_delete": "series.delete_series",
        "purge_without_downloads": "series.delete_series",
        "without_downloads_count": "series.view_series",
    }
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
