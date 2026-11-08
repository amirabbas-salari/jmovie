import logging
from uuid import uuid4

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.throttling import ScopedRateThrottle

from .models import AIConversation, AIMessage
from .services.agent import JMovieAgent

logger = logging.getLogger(__name__)

MAX_MESSAGE_LENGTH = 2000


class AIChatView(APIView):
    # این endpoint برای مهمان هم باز است و به API پولی LLM وصل می‌شود؛
    # سقف ساعتی (settings: ai_chat) جلوی سوءاستفاده‌ی هزینه‌ای را می‌گیرد.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ai_chat"

    def post(self, request):

        message = request.data.get("message", "").strip()
        conversation_id = request.data.get("conversation_id")
        session_id = request.data.get("session_id")

        if not message:
            return Response(
                {
                    "detail": "Message is required."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(message) > MAX_MESSAGE_LENGTH:
            return Response(
                {
                    "detail": f"Message must be at most {MAX_MESSAGE_LENGTH} characters."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # --------------------------------
            # Determine authentication state
            # --------------------------------

            is_authenticated = (
                request.user
                and request.user.is_authenticated
            )

            # --------------------------------
            # Existing conversation
            # --------------------------------

            if conversation_id:

                try:
                    conversation = AIConversation.objects.get(
                        id=conversation_id
                    )
                except AIConversation.DoesNotExist:
                    return Response(
                        {
                            "detail": "Conversation not found."
                        },
                        status=status.HTTP_404_NOT_FOUND,
                    )

                # ----------------------------
                # Check ownership
                # ----------------------------

                if is_authenticated:

                    if conversation.user_id != request.user.id:
                        return Response(
                            {
                                "detail": (
                                    "You do not have access "
                                    "to this conversation."
                                )
                            },
                            status=status.HTTP_403_FORBIDDEN,
                        )

                else:

                    if (
                        not session_id
                        or conversation.session_id != session_id
                    ):
                        return Response(
                            {
                                "detail": (
                                    "You do not have access "
                                    "to this conversation."
                                )
                            },
                            status=status.HTTP_403_FORBIDDEN,
                        )

            # --------------------------------
            # New conversation
            # --------------------------------

            else:

                if is_authenticated:

                    conversation = AIConversation.objects.create(
                        user=request.user,
                    )

                else:

                    session_id = session_id or str(uuid4())

                    conversation = AIConversation.objects.create(
                        session_id=session_id,
                    )

            # --------------------------------
            # Load conversation history
            # --------------------------------

            history_messages = conversation.messages.filter(
                role__in=["user", "assistant"]
            ).order_by("created_at")

            history = [
                {
                    "role": msg.role,
                    "content": msg.content,
                }
                for msg in history_messages
            ]

            # --------------------------------
            # Save user message
            # --------------------------------

            AIMessage.objects.create(
                conversation=conversation,
                role="user",
                content=message,
            )

            # --------------------------------
            # Run AI Agent
            # --------------------------------

            agent = JMovieAgent()

            result = agent.run(
                user_message=message,
                history=history,
            )

            # --------------------------------
            # Normalize agent result
            # --------------------------------

            if isinstance(result, str):

                response_data = {
                    "type": "text",
                    "message": result,
                    "items": [],
                    "request": None,
                }

            else:

                response_data = {
                    "type": result.get("type", "text"),
                    "message": result.get("message", ""),
                    "items": result.get("items", []),
                    "request": result.get("request"),
                }

            # --------------------------------
            # Save assistant message
            # --------------------------------

            AIMessage.objects.create(
                conversation=conversation,
                role="assistant",
                content=response_data["message"],
            )

            # --------------------------------
            # Response
            # --------------------------------

            return Response(
                {
                    "conversation_id": conversation.id,
                    "session_id": conversation.session_id,
                    **response_data,
                },
                status=status.HTTP_200_OK,
            )

        except Exception:
            # متن خام استثنا ممکن است جزئیات داخلی (آدرس سرویس، کلید،
            # ساختار دیتابیس) را لو بدهد؛ فقط سمت سرور لاگ می‌شود و کاربر
            # پیام عمومی می‌بیند.
            logger.exception("AI chat failed")
            return Response(
                {
                    "detail": "AI service is currently unavailable.",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
