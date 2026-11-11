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
from .services import ContentAgent


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
    """اجرای دستی ایجنت از پنل (همزمان؛ سقف پیش‌فرض ۲۰ اثر)."""

    permission_classes = [IsStaffMember, AgentWritePermission]

    def post(self, request):
        sources = request.data.get("sources") or None
        max_items = request.data.get("max_items") or None
        if max_items is not None:
            try:
                max_items = max(1, min(int(max_items), 100))
            except (TypeError, ValueError):
                return Response(
                    {"max_items": "باید عدد باشد."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        agent = ContentAgent()
        run = agent.run(
            triggered_by=request.user,
            trigger_type=AgentRun.TRIGGER_MANUAL,
            sources=sources,
            max_items=max_items,
        )
        return Response(
            AgentRunSerializer(run).data, status=status.HTTP_201_CREATED
        )


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
