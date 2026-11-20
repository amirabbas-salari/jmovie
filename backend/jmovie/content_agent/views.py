from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from adminAPI.permissions import IsStaffMember
from movies.models import Movie
from series.models import Series

from .models import AgentImportedItem, AgentRun, AgentSettings
from .serializers import (
    AgentImportedItemSerializer,
    AgentRunSerializer,
    AgentSettingsSerializer,
)
from .services import (
    AlreadyExists,
    AmbiguousImdb,
    ContentAgent,
    ImdbNotFound,
)


class AgentWritePermission(permissions.BasePermission):
    """اجرا/تأیید/رد ایجنت: staff بودن کافی نیست؛ مجوز اختصاصی لازم است
    (سوپرادمین همیشه دارد؛ برای بقیه از صفحه‌ی نقش‌ها قابل واگذاری است)."""

    message = "برای کار با ایجنت محتوا مجوز «content_agent.add_agentrun» لازم است."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and (user.is_staff or user.is_superuser)):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(user.is_superuser or user.has_perm("content_agent.add_agentrun"))


class AgentSettingsView(APIView):
    permission_classes = [IsStaffMember, AgentWritePermission]

    def get(self, request):
        return Response(AgentSettingsSerializer(AgentSettings.load()).data)

    def patch(self, request):
        settings_obj = AgentSettings.load()
        serializer = AgentSettingsSerializer(
            settings_obj, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class AgentRunView(APIView):
    """اجرای دستی ایجنت از پنل — در پس‌زمینه اجرا می‌شود تا درخواست HTTP
    به‌خاطر طولانی‌شدن کار (TMDB + ترجمه + لینک دانلود) timeout نگیرد.
    پنل وضعیت را از فهرست اجراها poll می‌کند."""

    permission_classes = [IsStaffMember, AgentWritePermission]

    def post(self, request):
        sources = request.data.get("sources") or None
        max_items = request.data.get("max_items") or None
        media_types = request.data.get("media_types") or None
        if media_types is not None:
            if not isinstance(media_types, list) or any(
                t not in ("movie", "series") for t in media_types
            ):
                return Response(
                    {"media_types": "باید فهرستی شامل movie و/یا series باشد."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if max_items is not None:
            try:
                max_items = max(1, min(int(max_items), 1000))
            except (TypeError, ValueError):
                return Response(
                    {"max_items": "باید عدد باشد."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        from datetime import timedelta

        recent_running = AgentRun.objects.filter(
            status=AgentRun.STATUS_RUNNING,
            started_at__gte=timezone.now() - timedelta(minutes=30),
        ).exists()
        if recent_running:
            return Response(
                {"detail": "یک اجرای ایجنت همین حالا در حال انجام است؛ صبر کنید تمام شود."},
                status=status.HTTP_409_CONFLICT,
            )
        agent = ContentAgent()
        run = agent.run_async(
            triggered_by=request.user,
            sources=sources,
            max_items=max_items,
            media_types=media_types,
        )
        return Response(
            AgentRunSerializer(run).data, status=status.HTTP_202_ACCEPTED
        )


class AgentImportByImdbView(APIView):
    """افزودن دستی یک فیلم/سریال با IMDb ID از پنل.

    هم‌زمان انجام می‌شود (یک اثر است، نه کشف انبوه): اگر لینک دانلود
    پیدا شود اثر منتشرشده برمی‌گردد، وگرنه پیش‌نویس می‌ماند تا ادمین
    تصمیم بگیرد — برخلاف اجرای انبوه، اثر بی‌لینک اینجا حذف نمی‌شود.
    """

    permission_classes = [IsStaffMember, AgentWritePermission]

    def post(self, request):
        imdb_id = request.data.get("imdb_id") or ""
        media_type = request.data.get("media_type") or None
        if media_type is not None and media_type not in ("movie", "series"):
            return Response(
                {"media_type": "باید movie یا series باشد (یا خالی برای تشخیص خودکار)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        agent = ContentAgent()
        try:
            item = agent.import_by_imdb(
                imdb_id, media_type=media_type, triggered_by=request.user
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except ImdbNotFound as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except AmbiguousImdb as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except AlreadyExists:
            existing = self._find_existing(imdb_id)
            return Response(
                {
                    "detail": "این اثر قبلاً در سایت هست.",
                    "existing": existing,
                },
                status=status.HTTP_409_CONFLICT,
            )
        return Response(
            {
                "item": AgentImportedItemSerializer(item).data,
                "summary": getattr(item, "download_summary", None),
            },
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    def _find_existing(imdb_id):
        """اثر موجود با این IMDb برای لینک مستقیم ویرایش در پنل."""
        from .services import normalize_imdb_id

        try:
            normalized = normalize_imdb_id(imdb_id)
        except ValueError:
            return None
        for model, media_type in ((Movie, "movie"), (Series, "series")):
            media = model.objects.filter(imdb_id=normalized).first()
            if media is not None:
                base = "movies" if media_type == "movie" else "series"
                return {
                    "media_type": media_type,
                    "id": media.id,
                    "title": media.title,
                    "admin_edit_path": f"/admin/{base}/{media.id}/edit",
                }
        return None


class AgentRunListView(APIView):
    permission_classes = [IsStaffMember]

    def get(self, request):
        runs = AgentRun.objects.select_related("triggered_by")[:30]
        return Response(AgentRunSerializer(runs, many=True).data)


class AgentDraftListView(APIView):
    permission_classes = [IsStaffMember]

    def get(self, request):
        qs = AgentImportedItem.objects.all()
        status_param = request.query_params.get("status", "pending")
        if status_param != "all":
            qs = qs.filter(status=status_param)
        media_type = request.query_params.get("media_type")
        if media_type in ("movie", "series"):
            qs = qs.filter(media_type=media_type)
        counts = {
            s: AgentImportedItem.objects.filter(status=s).count()
            for s in ("pending", "approved", "rejected")
        }
        return Response(
            {
                "results": AgentImportedItemSerializer(qs[:200], many=True).data,
                "counts": counts,
            }
        )


def _set_media_active(item, active):
    model = Movie if item.media_type == "movie" else Series
    if item.object_id:
        model.objects.filter(id=item.object_id).update(is_active=active)


def _get_media(item):
    model = Movie if item.media_type == "movie" else Series
    if not item.object_id:
        return None
    return model.objects.filter(id=item.object_id).first()


class AgentDraftFetchDownloadsView(APIView):
    """گرفتن/تلاش مجدد لینک‌های دانلود یک پیش‌نویس از سایت دوم (تنظیمات)."""

    permission_classes = [IsStaffMember, AgentWritePermission]

    def post(self, request, pk):
        try:
            item = AgentImportedItem.objects.get(pk=pk)
        except AgentImportedItem.DoesNotExist:
            return Response(
                {"detail": "یافت نشد."}, status=status.HTTP_404_NOT_FOUND
            )
        media = _get_media(item)
        if media is None:
            return Response(
                {"detail": "اثر این پیش‌نویس در سایت پیدا نشد."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        summary = ContentAgent().fetch_downloads_for(media, item.media_type)
        return Response(
            {
                "summary": summary,
                "item": AgentImportedItemSerializer(item).data,
            }
        )


class AgentDraftActionView(APIView):
    """approve → انتشار اثر (is_active=True) | reject → ماندن مخفی + لیست سیاه"""

    permission_classes = [IsStaffMember, AgentWritePermission]

    def post(self, request, pk, action):
        if action not in ("approve", "reject"):
            return Response(
                {"detail": "عملیات نامعتبر است."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            item = AgentImportedItem.objects.get(pk=pk)
        except AgentImportedItem.DoesNotExist:
            return Response(
                {"detail": "یافت نشد."}, status=status.HTTP_404_NOT_FOUND
            )
        return Response(self._apply(request, item, action))

    def _apply(self, request, item, action):
        if action == "approve":
            if _get_media(item) is None:
                # اثر پاک شده؛ تأیید نباید الکی «منتشر شد» نشان دهد
                from rest_framework.exceptions import ValidationError

                raise ValidationError("اثر این پیش‌نویس در سایت پیدا نشد (احتمالاً حذف شده است).")
            _set_media_active(item, True)
            item.status = AgentImportedItem.STATUS_APPROVED
        else:
            _set_media_active(item, False)
            item.status = AgentImportedItem.STATUS_REJECTED
        item.reviewed_by = request.user
        item.reviewed_at = timezone.now()
        item.save(update_fields=["status", "reviewed_by", "reviewed_at"])
        return AgentImportedItemSerializer(item).data


class AgentDraftBulkActionView(APIView):
    permission_classes = [IsStaffMember, AgentWritePermission]

    def post(self, request):
        ids = request.data.get("ids") or []
        action = request.data.get("action")
        if action not in ("approve", "reject") or not isinstance(ids, list):
            return Response(
                {"detail": "ids و action (approve/reject) لازم است."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        action_view = AgentDraftActionView()
        updated = 0
        for item in AgentImportedItem.objects.filter(id__in=ids):
            action_view._apply(request, item, action)
            updated += 1
        return Response({"updated": updated})
