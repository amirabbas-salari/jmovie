from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from . import notify
from .models import SupportMessage
from .serializers import SupportMessageCreateSerializer


@api_view(['GET'])
def test_api(request):
    return Response({
        "message": "Hello from Django API"
    })


def _client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


class SupportMessageCreateView(generics.CreateAPIView):
    """ثبت پیام از صفحه‌ی حمایت/پشتیبانی (عمومی، بدون نیاز به لاگین).

    POST /support/messages/
    {category: general|report|request, name, email, subject, message, meta}

    پیام همیشه در دیتابیس ذخیره می‌شود؛ بعد از آن در صورت تنظیم بودن
    envها، برای ادمین به تلگرام و/یا ایمیل هم ارسال می‌شود.
    سقف ارسال با throttle روی IP اعمال می‌شود (scope: support).
    """

    queryset = SupportMessage.objects.all()
    serializer_class = SupportMessageCreateSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "support"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if serializer.validated_data.get("website"):
            # بات اسپم تله را پر کرده؛ وانمود می‌کنیم موفق بوده ولی چیزی
            # ذخیره/ارسال نمی‌کنیم.
            return Response({"ok": True}, status=status.HTTP_201_CREATED)
        msg = SupportMessage.objects.create(
            category=serializer.validated_data.get("category", SupportMessage.CATEGORY_GENERAL),
            name=serializer.validated_data.get("name", ""),
            email=serializer.validated_data.get("email", ""),
            subject=serializer.validated_data.get("subject", ""),
            message=serializer.validated_data["message"],
            meta=serializer.validated_data.get("meta", {}),
            ip_address=_client_ip(request),
        )
        delivered = notify.notify_support_message(msg)
        return Response(
            {"ok": True, "id": msg.id, "delivered_via": delivered},
            status=status.HTTP_201_CREATED,
        )
