from django.contrib.contenttypes.models import ContentType
from django.db.models import Q
from rest_framework import viewsets, permissions, filters
from rest_framework.exceptions import ValidationError
from rest_framework.throttling import ScopedRateThrottle

from drf_spectacular.utils import (
    extend_schema,
    OpenApiParameter,
    OpenApiTypes,
)

from .models import Comment
from .serializers import CommentSerializer, CommentCreateSerializer
from accounts.permissions import IsOwner


@extend_schema(
    parameters=[
        OpenApiParameter(
            name="content_type",
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            description="Model name (e.g. movie, post, article)",
        ),
        OpenApiParameter(
            name="object_id",
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            description="ID of the target object",
        ),
    ]
)
class CommentViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwner]

    filter_backends = [filters.OrderingFilter]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "create":
            return CommentCreateSerializer
        return CommentSerializer

    def get_throttles(self):
        # سقف ساخت کامنت فقط روی POST؛ خواندن لیست نباید محدود شود.
        if self.action == "create":
            throttle = ScopedRateThrottle()
            throttle.scope = "comments"
            return [throttle]
        return []

    def get_queryset(self):
        queryset = Comment.objects.select_related("user")

        # نظارت (moderation) باید واقعاً اعمال شود: قبلاً همه‌ی کامنت‌ها —
        # حتی تأییدنشده و غیرفعال — عمومی نمایش داده می‌شدند و صف بررسی
        # ادمین عملاً بی‌اثر بود. حالا عموم فقط تأییدشده‌های فعال را
        # می‌بینند و هر کاربر کامنت‌های خودش (در انتظار تأیید) را هم می‌بیند.
        visible = Q(is_active=True, is_approved=True)
        if self.request.user.is_authenticated:
            visible |= Q(user=self.request.user)
        queryset = queryset.filter(visible)

        content_type = self.request.query_params.get("content_type")
        object_id = self.request.query_params.get("object_id")

        if content_type and object_id:
            try:
                ct = ContentType.objects.get(model=content_type)
            except ContentType.DoesNotExist:
                raise ValidationError("Invalid content_type")

            queryset = queryset.filter(
                content_type=ct,
                object_id=object_id,
            )

        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
