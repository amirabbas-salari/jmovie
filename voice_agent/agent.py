"""ایجنت صوتی دستیار سینمایی مووی‌ورس (LiveKit Agents، پایپ‌لاین آبشاری).

جریان مکالمه:
    میکروفون کاربر → LiveKit → STT (Whisper روی سرور لوکال Speaches)
    → LLM (OpenAI-compatible؛ پیش‌فرض OpenRouter، قابل جابه‌جایی با لوکال)
    → ابزارهای کاتالوگ جنگو (فقط از /ai/assistant/tool/ با سکرت داخلی)
    → TTS (Piper فارسی روی همان سرور Speaches) → بلندگوی کاربر

پشته‌ی گفتار کاملاً رایگان و خودمیزبان است (Speaches: faster-whisper
برای شنیدن + Piper/Kokoro برای صحبت‌کردن، پشت API سازگار با OpenAI)؛
هیچ حساب ابری یا کلید پولی برای صدا لازم نیست. راه‌اندازی سرور گفتار:
voice_agent/README.md و فایل docker-compose.speech.yml.

حالت‌های آواتار (listening/thinking/speaking/idle) و کارت‌های پیشنهاد
از روی دیتاچنل LiveKit برای فرانت ارسال می‌شوند تا آواتار سه‌بعدی و
کارت‌های داخل سایت هم‌زمان به‌روز شوند.

هیچ credentialای در کد نیست؛ همه از env خوانده می‌شود. اگر کلیدهای
لازم نباشند ایجنت با پیام روشن متوقف می‌شود (حالت جعلی ساخته نمی‌شود).
صدای خام کاربر لاگ/ذخیره نمی‌شود.
"""
import asyncio
import json
import logging
import os

import httpx
from livekit import agents
from livekit.agents import Agent, AgentSession, JobContext, RoomInputOptions, function_tool
from livekit.plugins import openai, silero

logger = logging.getLogger("jmovie-voice-agent")

# ---------------------------------------------------------------------------
# پیکربندی (فقط env — نمونه در .env.example)
# ---------------------------------------------------------------------------
DJANGO_API_BASE = os.getenv("JMOVIE_API_BASE", "http://localhost:8000").rstrip("/")
INTERNAL_SECRET = os.getenv("ASSISTANT_INTERNAL_SECRET", "")

# سرور گفتار لوکال (Speaches) — بدون کلید واقعی؛ api_key فقط چون کلاینت
# OpenAI مقدار خالی قبول نمی‌کند و سرور لوکال آن را بررسی نمی‌کند.
SPEECH_BASE_URL = os.getenv("SPEECH_BASE_URL", "http://localhost:8001/v1").rstrip("/")
SPEECH_API_KEY = os.getenv("SPEECH_API_KEY", "speaches")
STT_MODEL = os.getenv("STT_MODEL", "Systran/faster-whisper-large-v3")
STT_LANGUAGE = os.getenv("STT_LANGUAGE", "fa")
TTS_MODEL = os.getenv("TTS_MODEL", "speaches-ai/piper-fa_IR-amir-medium")
TTS_VOICE = os.getenv("TTS_VOICE", "amir")

# LLM از هر endpoint سازگار با OpenAI؛ پیش‌فرض OpenRouter (همان کلید چت
# متنی سایت). برای اجرای کاملاً لوکال: LLM_BASE_URL=http://localhost:11434/v1
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
LLM_API_KEY = os.getenv("LLM_API_KEY", "") or os.getenv("OPENROUTER_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "") or os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")

SYSTEM_PROMPT = """تو دستیار سینمایی مجازی سایت «مووی‌ورس» هستی؛ یک مشاور سینمایی صمیمی، حرفه‌ای و خوش‌صحبت که فارسی محاوره‌ای و طبیعی حرف می‌زند.

شخصیت و قواعد:
- پاسخ‌ها کوتاه، گرم و مناسب شنیدن با صدا باشند (معمولاً ۲ تا ۴ جمله). از فهرست‌های طولانی و خواندن همه‌ی جزئیات خودداری کن؛ فقط مهم‌ترین‌ها را بگو.
- هرگز امتیاز، بازیگر، سال انتشار یا جزئیات فیلم/سریال را از خودت نساز. برای هر اطلاعات واقعی درباره‌ی یک اثر حتماً از ابزارها استفاده کن.
- فقط وقتی می‌توانی بگویی فیلمی «در مووی‌ورس هست» که ابزار آن را برگردانده باشد. اگر اثری در آرشیو نبود صادقانه بگو و جایگزین مشابه پیشنهاد بده.
- بدون اسپویلر حرف بزن؛ فقط اگر کاربر صریحاً خواست، با هشدار اسپویل توضیح بده.
- اگر سلیقه‌ی کاربر مبهم بود، یکی دو سؤال کوتاه و پیگیرانه بپرس (ژانر؟ فیلم یا سریال؟ حال‌وهوای امشب؟ محدودیت زمانی؟) و بعد پیشنهاد دقیق بده.
- برای پیشنهاد از recommend_titles، برای اثر مشخص از get_title_details، برای «شبیه X» از search_similar_titles و برای مقایسه از compare_titles استفاده کن.
- وقتی چند پیشنهاد می‌دهی، حداکثر ۳ تا را با صدای بلند معرفی کن و برای هرکدام یک دلیل کوتاه متناسب با سلیقه‌ی کاربر بگو؛ بقیه روی کارت‌های سایت دیده می‌شوند.
- نام فیلم‌ها را همان‌طور که ابزار برمی‌گرداند بگو.
"""


def require_config():
    missing = []
    using_openrouter = "openrouter.ai" in LLM_BASE_URL
    if using_openrouter and not LLM_API_KEY:
        missing.append("OPENROUTER_API_KEY (برای LLM؛ یا LLM_BASE_URL را روی یک سرور لوکال بگذار)")
    if not INTERNAL_SECRET:
        missing.append("ASSISTANT_INTERNAL_SECRET (سکرت مشترک با جنگو)")
    if not os.getenv("LIVEKIT_URL") or not os.getenv("LIVEKIT_API_KEY") or not os.getenv("LIVEKIT_API_SECRET"):
        missing.append("LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET (LiveKit Cloud)")
    if missing:
        raise SystemExit(
            "پیکربندی ایجنت صوتی کامل نیست. متغیرهای زیر را در env ست کن:\n- "
            + "\n- ".join(missing)
            + "\nراهنما: docs/assistant/SETUP.md"
        )


def build_stt():
    """شنیدن: Whisper روی سرور گفتار لوکال (فارسی را هم پشتیبانی می‌کند)."""
    return openai.STT(
        model=STT_MODEL,
        language=STT_LANGUAGE,
        base_url=SPEECH_BASE_URL,
        api_key=SPEECH_API_KEY,
    )


def build_tts():
    """صحبت‌کردن: Piper فارسی (پیش‌فرض) یا هر مدل TTS همان سرور لوکال."""
    return openai.TTS(
        model=TTS_MODEL,
        voice=TTS_VOICE,
        base_url=SPEECH_BASE_URL,
        api_key=SPEECH_API_KEY,
    )


async def warn_if_speech_server_down():
    """سرور گفتار لوکال را فقط هشدار می‌دهیم؛ نبودنش نباید کل ایجنت را بخواباند."""
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            response = await client.get(f"{SPEECH_BASE_URL}/models")
            response.raise_for_status()
    except Exception:  # noqa: BLE001
        logger.warning(
            "سرور گفتار لوکال در %s پاسخ نداد؛ مکالمه‌ی صوتی کار نمی‌کند. "
            "راه‌اندازی: docker compose -f docker-compose.speech.yml up -d "
            "(جزئیات در voice_agent/README.md)",
            SPEECH_BASE_URL,
        )


# ---------------------------------------------------------------------------
# کلاینت ابزارهای کاتالوگ جنگو — LLM هرگز مستقیم به دیتابیس وصل نمی‌شود
# ---------------------------------------------------------------------------
class CatalogClient:
    def __init__(self):
        self._client = httpx.AsyncClient(timeout=20.0)

    async def call(self, tool: str, arguments: dict) -> dict:
        response = await self._client.post(
            f"{DJANGO_API_BASE}/ai/assistant/tool/",
            json={"tool": tool, "arguments": arguments},
            headers={"X-Assistant-Secret": INTERNAL_SECRET},
        )
        response.raise_for_status()
        return response.json().get("result") or {}


def _extract_cards(tool: str, result: dict) -> list:
    if tool in ("search_movies", "search_series", "recommend_titles"):
        return result.get("results") or []
    if tool == "search_similar_titles":
        return result.get("results") or []
    if tool == "get_title_details":
        return [result] if result.get("found") else []
    if tool == "compare_titles":
        return result.get("items") or []
    return []


def _compact_for_llm(result: dict) -> str:
    """نسخه‌ی فشرده و قابل‌خواندن برای LLM (بدون فیلدهای نمایشی کارت)."""

    def slim(card):
        return {
            "title": card.get("title"),
            "original_title": card.get("original_title"),
            "type": card.get("media_type"),
            "year": card.get("year"),
            "rating": card.get("rating"),
            "genres": card.get("genres"),
            "runtime_minutes": card.get("runtime"),
            "seasons": card.get("seasons_count"),
        }

    out = {}
    if "results" in result:
        out["results"] = [slim(c) for c in (result.get("results") or [])[:6]]
    if result.get("found") is not None and "results" not in result:
        out = dict(result)
        for key in ("poster_url", "backdrop_url", "slug", "url", "id"):
            out.pop(key, None)
    if "items" in result:
        out["items"] = [slim(c) for c in (result.get("items") or [])[:3]]
        out["missing"] = result.get("missing") or []
    return json.dumps(out, ensure_ascii=False)[:4000]


# ---------------------------------------------------------------------------
# ایجنت
# ---------------------------------------------------------------------------
class MovieVerseAssistant(Agent):
    def __init__(self, room, catalog: CatalogClient):
        super().__init__(instructions=SYSTEM_PROMPT)
        self._room = room
        self._catalog = catalog

    async def _publish(self, payload: dict):
        try:
            await self._room.local_participant.publish_data(
                json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                reliable=True,
                topic="assistant",
            )
        except Exception:  # noqa: BLE001 — دیتاچنل نباید مکالمه را قطع کند
            logger.debug("publish_data failed", exc_info=True)

    async def publish_state(self, state: str):
        await self._publish({"type": "assistant_state", "state": state})

    async def _run_tool(self, tool: str, arguments: dict) -> str:
        await self.publish_state("thinking")
        result = await self._catalog.call(tool, arguments)
        cards = _extract_cards(tool, result)
        if cards:
            await self._publish({"type": "assistant_cards", "titles": cards})
        return _compact_for_llm(result)

    # --- ابزارهای LLM (تعریف‌شده در بریف) ---

    @function_tool
    async def search_movies(
        self,
        query: str = "",
        genre: str = "",
        year: int = 0,
        min_rating: float = 0,
        max_runtime: int = 0,
        limit: int = 6,
    ) -> str:
        """جستجوی فیلم در آرشیو مووی‌ورس بر اساس نام، ژانر، سال، حداقل امتیاز یا حداکثر مدت‌زمان (دقیقه)."""
        return await self._run_tool("search_movies", {
            "query": query, "genre": genre or None, "year": year or None,
            "min_rating": min_rating or None, "max_runtime": max_runtime or None,
            "limit": limit,
        })

    @function_tool
    async def search_series(
        self,
        query: str = "",
        genre: str = "",
        year: int = 0,
        min_rating: float = 0,
        limit: int = 6,
    ) -> str:
        """جستجوی سریال در آرشیو مووی‌ورس بر اساس نام، ژانر، سال یا حداقل امتیاز."""
        return await self._run_tool("search_series", {
            "query": query, "genre": genre or None, "year": year or None,
            "min_rating": min_rating or None, "limit": limit,
        })

    @function_tool
    async def get_title_details(self, title: str, media_type: str = "") -> str:
        """جزئیات کامل یک فیلم یا سریال از آرشیو: خلاصه، امتیاز، ژانر، بازیگران و کارگردان. media_type می‌تواند movie یا series باشد."""
        return await self._run_tool("get_title_details", {
            "title": title, "media_type": media_type or None,
        })

    @function_tool
    async def compare_titles(self, titles: list[str]) -> str:
        """مقایسه‌ی دو یا سه فیلم/سریال از نظر امتیاز، سال، ژانر و مدت‌زمان بر اساس داده‌ی واقعی آرشیو."""
        return await self._run_tool("compare_titles", {"titles": titles[:3]})

    @function_tool
    async def recommend_titles(
        self,
        genres: list[str] | None = None,
        media_type: str = "both",
        min_rating: float = 0,
        year_from: int = 0,
        year_to: int = 0,
        max_runtime: int = 0,
        limit: int = 6,
    ) -> str:
        """پیشنهاد فیلم/سریال بر اساس ژانر، نوع (movie/series/both)، امتیاز، بازه‌ی سال و محدودیت زمانی. برای وقتی کاربر سلیقه‌اش را می‌گوید."""
        return await self._run_tool("recommend_titles", {
            "genres": genres or None, "media_type": media_type,
            "min_rating": min_rating or None, "year_from": year_from or None,
            "year_to": year_to or None, "max_runtime": max_runtime or None,
            "limit": limit,
        })

    @function_tool
    async def search_similar_titles(self, title: str, media_type: str = "") -> str:
        """یافتن فیلم/سریال‌های مشابه یک اثر مشخص در آرشیو (بر اساس ژانرهای مشترک و نزدیکی امتیاز)."""
        return await self._run_tool("search_similar_titles", {
            "title": title, "media_type": media_type or None,
        })


async def entrypoint(ctx: JobContext):
    require_config()
    await warn_if_speech_server_down()
    catalog = CatalogClient()
    assistant = MovieVerseAssistant(ctx.room, catalog)

    session = AgentSession(
        stt=build_stt(),
        llm=openai.LLM(
            model=LLM_MODEL,
            api_key=LLM_API_KEY or "local",
            base_url=LLM_BASE_URL,
        ),
        tts=build_tts(),
        vad=silero.VAD.load(),
    )

    # حالت آواتار فرانت از وضعیت واقعی ایجنت می‌آید، نه از تایمر/حدس
    @session.on("agent_state_changed")
    def _on_agent_state(ev):
        asyncio.create_task(assistant.publish_state(ev.new_state))

    @session.on("user_state_changed")
    def _on_user_state(ev):
        if ev.new_state == "speaking":
            asyncio.create_task(assistant.publish_state("listening"))

    await ctx.connect()
    await session.start(
        assistant,
        room=ctx.room,
        room_input_options=RoomInputOptions(noise_cancellation=None),
    )

    # سلام آغازین کوتاه (با همان شخصیت و بدون ساختن اطلاعات سینمایی)
    session.generate_reply(
        instructions=(
            "به فارسی محاوره‌ای و کوتاه سلام کن، خودت را دستیار سینمایی مووی‌ورس معرفی کن "
            "و بپرس امشب چه فیلمی یا سریالی دوست دارد ببیند. حداکثر دو جمله."
        )
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
