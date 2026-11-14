from django.urls import path

from .assistant_views import (
    AssistantLiveKitTokenView,
    AssistantMessageView,
    AssistantStatusView,
    AssistantToolView,
)
from .views import AIChatView


urlpatterns = [
    path("chat/", AIChatView.as_view(), name="ai-chat"),
    # دستیار سینمایی مجازی (صوتی LiveKit + fallback متنی مرورگر)
    path("assistant/livekit-token/", AssistantLiveKitTokenView.as_view(), name="assistant-livekit-token"),
    path("assistant/message/", AssistantMessageView.as_view(), name="assistant-message"),
    path("assistant/status/", AssistantStatusView.as_view(), name="assistant-status"),
    path("assistant/tool/", AssistantToolView.as_view(), name="assistant-tool"),
]