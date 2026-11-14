"""اندپوینت‌های دستیار سینمایی مجازی (صوتی/متنی).

معماری: LiveKit اتاق و صدا را مدیریت می‌کند؛ ایجنت صوتی پایتون
(پوشه‌ی voice_agent) کاربر را می‌شنود و از ابزارهای کاتالوگ جنگو
استفاده می‌کند. جنگو فقط این سه کار را می‌کند:

1. صدور توکن کوتاه‌عمر LiveKit برای مرورگر (سکرت هرگز به فرانت
   نمی‌رود؛ فقط کلاینت‌های مجاز با هویت guest/user توکن می‌گیرند).
2. fallback متنی مرورگر (message/) وقتی LiveKit/ایجنت در دسترس
   نیست — کاملاً رایگان و بدون LLM.
3. status/ برای اینکه فرانت بداند حالت صوتی واقعی در دسترس است
   یا باید fallback را فعال کند.

تنظیمات از env خوانده می‌شوند (بدون کلید واقعی در کد):
    LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
    ASSISTANT_ROOM_PREFIX (پیش‌فرض: jmovie-assistant)
    ASSISTANT_TOKEN_TTL_MINUTES (پیش‌فرض: ۱۵)
"""
import logging
import os
import time
import uuid

import jwt as pyjwt
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import assistant_brain, assistant_tools

logger = logging.getLogger(__name__)

MAX_MESSAGE_LENGTH = 1000


def _livekit_config():
    return {
        "url": os.getenv("LIVEKIT_URL", "").strip(),
        "api_key": os.getenv("LIVEKIT_API_KEY", "").strip(),
        "api_secret": os.getenv("LIVEKIT_API_SECRET", "").strip(),
        "room_prefix": os.getenv("ASSISTANT_ROOM_PREFIX", "jmovie-assistant").strip() or "jmovie-assistant",
        "token_ttl": max(1, min(int(os.getenv("ASSISTANT_TOKEN_TTL_MINUTES", "15")), 60)),
    }


def livekit_configured():
    cfg = _livekit_config()
    return bool(cfg["url"] and cfg["api_key"] and cfg["api_secret"])


def build_livekit_token(identity, room, name="", can_publish=True, ttl_minutes=15):
    """توکن دسترسی LiveKit (JWT با grants حداقلی: فقط همین اتاق)."""
    cfg = _livekit_config()
    now = int(time.time())
    payload = {
        "iss": cfg["api_key"],
        "sub": str(identity),
        "name": name or str(identity),
        "iat": now,
        "nbf": now,
        "exp": now + ttl_minutes * 60,
        "jti": f"{identity}-{uuid.uuid4().hex[:12]}",
        "video": {
            "room": room,
            "roomJoin": True,
            "canPublish": bool(can_publish),
            "canSubscribe": True,
            "canPublishData": True,
        },
    }
    return pyjwt.encode(payload, cfg["api_secret"], algorithm="HS256")


class AssistantLiveKitTokenView(APIView):
    """POST /api/assistant/livekit-token/ — توکن کوتاه‌عمر اتاق صوتی.

    برای مهمان هم باز است (سایت عمومی است) ولی با throttle سخت
    محدود می‌شود تا سوءاستفاده از سهمیه‌ی رایگان LiveKit ممکن
    نباشد. توکن فقط به یک اتاق (با پیشوند ثابت + هویت جلسه) اجازه
    می‌دهد و پس از چند دقیقه منقضی می‌شود.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "assistant"

    def post(self, request):
        if not livekit_configured():
            return Response(
                {
                    "detail": "دستیار صوتی در حال حاضر فعال نیست.",
                    "livekit_configured": False,
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        cfg = _livekit_config()
        session_id = (request.data.get("session_id") or "").strip()
        if session_id:
            # فقط کاراکترهای امن در نام اتاق/هویت
            session_id = "".join(ch for ch in session_id if ch.isalnum() or ch in "-_")[:64]
        if not session_id:
            session_id = uuid.uuid4().hex[:16]

        user = request.user if request.user and request.user.is_authenticated else None
        identity = f"user-{user.id}" if user else f"guest-{session_id}"
        display_name = (getattr(user, "first_name", "") or getattr(user, "username", "")) if user else "مهمان مووی‌ورس"
        room = f"{cfg['room_prefix']}-{session_id}"

        token = build_livekit_token(
            identity=identity,
            room=room,
            name=display_name,
            can_publish=True,  # میکروفون کاربر
            ttl_minutes=cfg["token_ttl"],
        )
        return Response(
            {
                "token": token,
                "url": cfg["url"],
                "room": room,
                "identity": identity,
                "expires_in": cfg["token_ttl"] * 60,
            }
        )


class AssistantMessageView(APIView):
    """POST /api/assistant/message/ — fallback متنی/مرورگری.

    بدون LiveKit و بدون LLM: نیت کاربر از متن فهمیده می‌شود و پاسخ
    فقط از کاتالوگ واقعی سایت ساخته می‌شود (assistant_brain).
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "assistant"

    def post(self, request):
        message = (request.data.get("message") or "").strip()
        if not message:
            return Response(
                {"detail": "پیام نمی‌تواند خالی باشد."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(message) > MAX_MESSAGE_LENGTH:
            return Response(
                {"detail": f"پیام خیلی طولانی است (حداکثر {MAX_MESSAGE_LENGTH} کاراکتر)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        result = assistant_brain.respond(message)
        return Response(
            {
                "reply": result["reply"],
                "titles": result["titles"],
                "tool": result["tool"],
                "mode": "browser",
            }
        )


class AssistantStatusView(APIView):
    """GET /api/assistant/status/ — فرانت از این می‌فهمد کدام حالت‌ها فعال‌اند."""

    permission_classes = [AllowAny]

    def get(self, request):
        configured = livekit_configured()
        return Response(
            {
                "livekit_configured": configured,
                # حالت مرورگر همیشه در دسترس است (Web Speech داخل خود مرورگر)
                "browser_mode": True,
                "voice_mode": "livekit" if configured else "browser",
            }
        )


class AssistantToolView(APIView):
    """POST /api/assistant/tool/ — اجرای ابزار کاتالوگ برای ایجنت صوتی.

    فقط برای ایجنت داخلی (هدر X-Assistant-Secret) — LLM مستقیماً به
    دیتابیس وصل نمی‌شود و دستیار هم بدون این هدر نمی‌تواند صدا بزند.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "assistant"

    def post(self, request):
        secret = os.getenv("ASSISTANT_INTERNAL_SECRET", "")
        if not secret or request.headers.get("X-Assistant-Secret") != secret:
            return Response(
                {"detail": "دسترسی غیرمجاز."},
                status=status.HTTP_403_FORBIDDEN,
            )
        name = (request.data.get("tool") or "").strip()
        arguments = request.data.get("arguments") or {}
        try:
            result = assistant_tools.run_tool(name, arguments)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:  # noqa: BLE001 — خطای داخلی ابزار نباید ۵۰۰ خام بدهد
            logger.exception("assistant tool failed: %s", name)
            return Response(
                {"detail": "اجرای ابزار ناموفق بود."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response({"tool": name, "result": result})
