"""ایجنت صوتی دستیار سینمایی مووی‌ورس (LiveKit Agents، پایپ‌لاین آبشاری).

جریان مکالمه:
    میکروفون کاربر → LiveKit → STT ابری (LiveKit Inference)
    → LLM (OpenAI-compatible؛ پیش‌فرض OpenRouter)
    → ابزارهای کاتالوگ جنگو (فقط از /ai/assistant/tool/ با سکرت داخلی)
    → TTS ابری (LiveKit Inference) → بلندگوی کاربر

پشته‌ی گفتار پیش‌فرض، LiveKit Inference است: بدون هیچ حساب/کلید جدا،
با همان اعتبار LiveKit Cloud کار می‌کند و در پلن رایگان Build ماهانه
اعتبار Inference دارد (شنیدن Deepgram، صحبت‌کردن Cartesia). گزینه‌های
جایگزین با SPEECH_PROVIDER: ‏groq (پلن Free ‏Groq) و local (سرور
خودمیزبان Speaches و Piper فارسی). جزئیات: voice_agent/README.md.

حالت‌های آواتار (listening/thinking/speaking/idle) و کارت‌های پیشنهاد
از روی دیتاچنل LiveKit برای فرانت ارسال می‌شوند تا آواتار و کارت‌های
داخل سایت هم‌زمان به‌روز شوند. چهره می‌تواند ویدیوی زنده‌ی Tavus باشد
(با TAVUS_API_KEY و TAVUS_REPLICA_ID) وگرنه آواتار سه‌بعدی فرانت است.

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
from livekit.agents import Agent, AgentSession, JobContext, RoomInputOptions, function_tool, inference
from livekit.plugins import openai, silero, tavus

logger = logging.getLogger("jmovie-voice-agent")

# ---------------------------------------------------------------------------
# پیکربندی (فقط env — نمونه در .env.example)
# ---------------------------------------------------------------------------
DJANGO_API_BASE = os.getenv("JMOVIE_API_BASE", "http://localhost:8000").rstrip("/")
INTERNAL_SECRET = os.getenv("ASSISTANT_INTERNAL_SECRET", "")

# ---------------------------------------------------------------------------
# پشته‌ی گفتار (STT/TTS) — ارائه‌دهنده با SPEECH_PROVIDER انتخاب می‌شود:
#   livekit (پیش‌فرض): ‏LiveKit Inference با همان کلیدهای LiveKit Cloud؛
#          هیچ حساب سومی لازم نیست و در پلن رایگان Build اعتبار ماهانه دارد.
#   groq:  پلن Free ‏Groq — Whisper برای شنیدن و Orpheus انگلیسی برای
#          صحبت‌کردن. کلید: GROQ_API_KEY
#   local: سرور Speaches روی سرور خودتان با Piper فارسی (بدون کلید).
# هر مقدار را می‌توان جداگانه با env بازنویسی کرد (STT_MODEL و ...).
# ---------------------------------------------------------------------------
SPEECH_PROVIDER = os.getenv("SPEECH_PROVIDER", "livekit").strip().lower()

_SPEECH_PRESETS = {
    "livekit": {
        "kind": "inference",
        "stt_model": "deepgram/nova-3",
        "tts_model": "cartesia/sonic-3",
        "tts_voice": "",  # خالی = صدای پیش‌فرض مدل؛ یا آیدی صدای Cartesia
        "language": "en",
    },
    "groq": {
        "kind": "openai",
        "base_url": "https://api.groq.com/openai/v1",
        "api_key_env": "GROQ_API_KEY",
        "stt_model": "whisper-large-v3-turbo",
        "tts_model": "canopylabs/orpheus-v1-english",
        "tts_voice": "autumn",
        "tts_response_format": "wav",
        # Orpheus فقط انگلیسی صحبت می‌کند؛ مکالمه هم انگلیسی می‌شود.
        # (Whisper فارسی را هم می‌فهمد، ولی صدای خروجی انگلیسی است.)
        "language": "en",
    },
    "local": {
        "kind": "openai",
        "base_url": "http://localhost:8001/v1",
        "api_key_env": "",
        "stt_model": "Systran/faster-whisper-large-v3",
        "tts_model": "speaches-ai/piper-fa_IR-amir-medium",
        "tts_voice": "amir",
        "tts_response_format": "mp3",
        "language": "fa",
    },
}
_SPEECH = _SPEECH_PRESETS.get(SPEECH_PROVIDER, _SPEECH_PRESETS["livekit"])

SPEECH_BASE_URL = os.getenv("SPEECH_BASE_URL", _SPEECH.get("base_url", "")).rstrip("/")
# برای سرور لوکال کلید واقعی لازم نیست؛ مقدار صوری فقط چون کلاینت
# OpenAI مقدار خالی قبول نمی‌کند و سرور لوکال آن را بررسی نمی‌کند.
SPEECH_API_KEY = (
    os.getenv("SPEECH_API_KEY", "")
    or (os.getenv(_SPEECH["api_key_env"], "") if _SPEECH.get("api_key_env") else "")
    or "speaches"
)
STT_MODEL = os.getenv("STT_MODEL", _SPEECH["stt_model"])
TTS_MODEL = os.getenv("TTS_MODEL", _SPEECH["tts_model"])
TTS_VOICE = os.getenv("TTS_VOICE", _SPEECH["tts_voice"])
TTS_RESPONSE_FORMAT = os.getenv("TTS_RESPONSE_FORMAT", _SPEECH.get("tts_response_format", "mp3"))
# زبان مکالمه (شخصیت دستیار + زبان تشخیص گفتار)
ASSISTANT_LANGUAGE = os.getenv("ASSISTANT_LANGUAGE", _SPEECH["language"]).strip().lower()
STT_LANGUAGE = os.getenv("STT_LANGUAGE", ASSISTANT_LANGUAGE)

# ---------------------------------------------------------------------------
# چهره‌ی ویدیویی Tavus (اختیاری) — آواتار فوتورئالیستیک زنده روی همان اتاق
# LiveKit. فقط وقتی هر دو مقدار ست شده باشند فعال می‌شود؛ در غیر این صورت
# فرانت از آواتار سه‌بعدی داخلی استفاده می‌کند. صدای مکالمه همچنان از
# TTS خودمان می‌آید و Tavus فقط صورتِ هم‌گام با صدا را منتشر می‌کند.
# ---------------------------------------------------------------------------
TAVUS_API_KEY = os.getenv("TAVUS_API_KEY", "")
TAVUS_REPLICA_ID = os.getenv("TAVUS_REPLICA_ID", "")
TAVUS_PERSONA_ID = os.getenv("TAVUS_PERSONA_ID", "")


def tavus_enabled():
    return bool(TAVUS_API_KEY and TAVUS_REPLICA_ID)


# LLM از هر endpoint سازگار با OpenAI؛ پیش‌فرض OpenRouter (همان کلید چت
# متنی سایت). برای اجرای کاملاً لوکال: LLM_BASE_URL=http://localhost:11434/v1
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
LLM_API_KEY = os.getenv("LLM_API_KEY", "") or os.getenv("OPENROUTER_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "") or os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")

SYSTEM_PROMPT_FA = """تو دستیار سینمایی مجازی سایت «مووی‌ورس» هستی؛ یک مشاور سینمایی صمیمی، حرفه‌ای و خوش‌صحبت که فارسی محاوره‌ای و طبیعی حرف می‌زند.

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

# نسخه‌ی انگلیسی شخصیت — وقتی صدای خروجی انگلیسی است (مثل Orpheus ابری)
# مکالمه هم انگلیسی می‌شود تا TTS متن را درست بخواند.
SYSTEM_PROMPT_EN = """You are the virtual cinema assistant of the "MovieVerse" website: a friendly, professional movie consultant who speaks natural, conversational English.

Personality and rules:
- Keep spoken replies short, warm and easy to listen to (usually 2-4 sentences). Do not read long lists or every detail aloud; mention only the most important points.
- Never invent ratings, cast members, release years or any movie/series facts. For any real information about a title, always use the tools.
- Only say a title "is on MovieVerse" when a tool returned it. If a title is not in the catalog, say so honestly and suggest a similar alternative.
- No spoilers unless the user explicitly asks; warn before spoiling.
- If the user's taste is unclear, ask one or two short follow-up questions (genre? movie or series? tonight's mood? time limit?) and then recommend precisely.
- Use recommend_titles for recommendations, get_title_details for a specific title, search_similar_titles for "like X", and compare_titles for comparisons.
- When recommending several titles, introduce at most 3 aloud with a short reason tailored to the user's taste; the rest appear as cards on the site.
- Say title names exactly as the tools return them.
"""

SYSTEM_PROMPT = SYSTEM_PROMPT_EN if ASSISTANT_LANGUAGE.startswith("en") else SYSTEM_PROMPT_FA


def require_config():
    missing = []
    if SPEECH_PROVIDER == "groq" and not os.getenv("GROQ_API_KEY"):
        missing.append("GROQ_API_KEY (پلن رایگان Groq از console.groq.com؛ یا SPEECH_PROVIDER=local)")
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
    """شنیدن: LiveKit Inference (پیش‌فرض)، یا Groq/لوکال از مسیر OpenAI-compatible."""
    if _SPEECH["kind"] == "inference":
        # کلید جدا لازم نیست؛ از همان LIVEKIT_API_KEY/SECRET محیط استفاده می‌شود
        return inference.STT(model=STT_MODEL, language=STT_LANGUAGE)
    return openai.STT(
        model=STT_MODEL,
        language=STT_LANGUAGE,
        base_url=SPEECH_BASE_URL,
        api_key=SPEECH_API_KEY,
    )


def build_tts():
    """صحبت‌کردن: LiveKit Inference (پیش‌فرض)، یا Groq/لوکال از مسیر OpenAI-compatible."""
    if _SPEECH["kind"] == "inference":
        kwargs = {"language": ASSISTANT_LANGUAGE}
        if TTS_VOICE:
            kwargs["voice"] = TTS_VOICE
        return inference.TTS(model=TTS_MODEL, **kwargs)
    return openai.TTS(
        model=TTS_MODEL,
        voice=TTS_VOICE,
        base_url=SPEECH_BASE_URL,
        api_key=SPEECH_API_KEY,
        response_format=TTS_RESPONSE_FORMAT,
    )


async def warn_if_speech_server_down():
    """فقط برای حالت لوکال: نبود سرور گفتار را هشدار می‌دهیم، ایجنت نمی‌خوابد."""
    if SPEECH_PROVIDER != "local":
        return
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

    async def publish_avatar_mode(self, mode: str, detail: str = ""):
        """به فرانت می‌گوید چهره ویدیویی (tavus) فعال است یا آواتار سه‌بعدی (3d).

        در صورت خطا، خلاصه‌ی دلیل هم می‌رود تا کاربر به‌جای سکوت، علت را
        داخل ویجت ببیند (بدون هیچ credential یا داده‌ی حساسی).
        """
        payload = {"type": "assistant_avatar", "mode": mode}
        if detail:
            payload["detail"] = detail[:180]
        await self._publish(payload)

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

    # چهره‌ی ویدیویی Tavus (اگر کانفیگ شده باشد) — خرابی‌اش نباید مکالمه‌ی
    # صوتی را از کار بیندازد؛ فرانت در نبود ویدیو آواتار سه‌بعدی نشان می‌دهد.
    logger.info(
        "Tavus avatar: enabled=%s (api_key set=%s, replica_id set=%s)",
        tavus_enabled(), bool(TAVUS_API_KEY), bool(TAVUS_REPLICA_ID),
    )
    if tavus_enabled():
        try:
            avatar_kwargs = {
                # نام این مقدار در داشبورد Tavus ‏replica است؛ پلاگین آن را face_id می‌نامد
                "face_id": TAVUS_REPLICA_ID,
                "api_key": TAVUS_API_KEY,
                "avatar_participant_identity": "movieverse-avatar",
                "avatar_participant_name": "دستیار سینمایی مووی‌ورس",
            }
            if TAVUS_PERSONA_ID:
                avatar_kwargs["persona_id"] = TAVUS_PERSONA_ID
            avatar = tavus.AvatarSession(**avatar_kwargs)
            await avatar.start(session, room=ctx.room)
            await assistant.publish_avatar_mode("tavus")
            logger.info("Tavus avatar started (replica=%s)", TAVUS_REPLICA_ID)
        except Exception as exc:  # noqa: BLE001
            logger.warning("شروع آواتار Tavus ناموفق بود؛ ادامه بدون ویدیو", exc_info=True)
            await assistant.publish_avatar_mode("3d", detail=f"{type(exc).__name__}: {exc}")
    else:
        await assistant.publish_avatar_mode("3d")

    await session.start(
        assistant,
        room=ctx.room,
        room_input_options=RoomInputOptions(noise_cancellation=None),
    )

    # سلام آغازین کوتاه (با همان شخصیت و بدون ساختن اطلاعات سینمایی)
    if ASSISTANT_LANGUAGE.startswith("en"):
        greeting_instructions = (
            "Greet the user briefly in friendly English, introduce yourself as the "
            "MovieVerse cinema assistant, and ask what movie or series they feel "
            "like watching tonight. At most two sentences."
        )
    else:
        greeting_instructions = (
            "به فارسی محاوره‌ای و کوتاه سلام کن، خودت را دستیار سینمایی مووی‌ورس معرفی کن "
            "و بپرس امشب چه فیلمی یا سریالی دوست دارد ببیند. حداکثر دو جمله."
        )
    session.generate_reply(instructions=greeting_instructions)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
