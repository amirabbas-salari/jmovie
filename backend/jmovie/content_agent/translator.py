"""ترجمه‌ی عنوان/خلاصه به فارسی با سرویس AI موجود سایت (OpenRouter).

اگر کلید AI تنظیم نشده باشد یا خطایی رخ دهد، None برمی‌گردد و ایجنت
بدون ترجمه (با متن TMDB) ادامه می‌دهد — ترجمه هرگز نباید جلوی
واردکردن یک اثر را بگیرد.
"""
import logging

logger = logging.getLogger(__name__)

_SYSTEM = (
    "You are a professional Persian translator for a movie website. "
    "Translate the user's text to natural Persian (Farsi). "
    "Keep movie/series names transliterated appropriately. "
    "Return ONLY the translation, without quotes or explanations."
)


def translate_to_persian(text: str, *, is_title: bool = False) -> str | None:
    text = (text or "").strip()
    if not text:
        return None
    try:
        from ai.services.openrouter import OpenRouterService

        service = OpenRouterService()
        message = service.chat(
            [
                {"role": "system", "content": _SYSTEM},
                {
                    "role": "user",
                    "content": (
                        f"Translate this {'title' if is_title else 'synopsis'} to Persian:\n{text}"
                    ),
                },
            ]
        )
        content = (message.content or "").strip().strip('"')
        return content or None
    except Exception:
        logger.warning("AI translation unavailable; continuing without it", exc_info=True)
        return None


def contains_persian(text: str) -> bool:
    """آیا متن از قبل فارسی/عربی است؟ (برای تشخیص ترجمه‌ی آماده‌ی TMDB)"""
    return any("\u0600" <= ch <= "\u06FF" for ch in (text or ""))
