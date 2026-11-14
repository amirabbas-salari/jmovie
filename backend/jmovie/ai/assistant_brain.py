"""مغز مکالمه‌ی دستیار سینمایی برای حالت متنی/مرورگری.

بدون نیاز به هیچ سرویس خارجی کار می‌کند: نیت کاربر (پیشنهاد بر اساس
ژانر/مود/دوره، جزئیات یک اثر، مشابه، مقایسه، جستجوی عنوان) از روی متن
فارسی فهمیده می‌شود و جواب فقط از ابزارهای کاتالوگ (assistant_tools)
ساخته می‌شود — هیچ امتیاز/بازیگر/تاریخی ساخته نمی‌شود.

وقتی ایجنت صوتی LiveKit فعال باشد، همین ابزارها را LLM صدا می‌زند و
این ماژول فقط fallback مرورگر است.
"""
import re

from . import assistant_tools as tools

# نگاشت ژانر فارسی → نام‌های محتمل ژانر در دیتابیس (فارسی یا انگلیسی TMDB)
GENRE_KEYWORDS = {
    "اکشن": ["اکشن", "Action"],
    "کمدی": ["کمدی", "Comedy"],
    "درام": ["درام", "Drama"],
    "ترسناک": ["ترسناک", "وحشت", "Horror"],
    "علمی‌تخیلی": ["علمی‌تخیلی", "علمی تخیلی", "Science Fiction"],
    "علمی": ["علمی‌تخیلی", "علمی تخیلی", "Science Fiction"],
    "معمایی": ["معمایی", "Mystery"],
    "جنایی": ["جنایی", "Crime"],
    "عاشقانه": ["عاشقانه", "Romance"],
    "دلهره": ["دلهره", "هیجان‌انگیز", "Thriller"],
    "هیجانی": ["هیجانی", "Thriller"],
    "انیمیشن": ["انیمیشن", "Animation"],
    "ماجراجویی": ["ماجراجویی", "Adventure"],
    "فانتزی": ["فانتزی", "Fantasy"],
    "جنگی": ["جنگی", "War"],
    "تاریخی": ["تاریخی", "History"],
    "خانوادگی": ["خانوادگی", "Family"],
    "وسترن": ["وسترن", "Western"],
}

MOOD_KEYWORDS = {
    "غمگین": ["درام", "Drama"],
    "احساسی": ["درام", "Drama", "عاشقانه", "Romance"],
    "خنده": ["کمدی", "Comedy"],
    "شاد": ["کمدی", "Comedy", "انیمیشن", "Animation"],
    "هیجان": ["اکشن", "Action", "دلهره", "Thriller"],
    "ترس": ["ترسناک", "Horror"],
    "فکری": ["معمایی", "Mystery", "درام", "Drama"],
    "پیچیده": ["معمایی", "Mystery"],
}

GREETINGS = ("سلام", "درود", "هی", "hello", "hi")

# واژه‌های پرکننده‌ی انتهای جمله که جزو اسم فیلم/سریال نیستند
_TITLE_FILLERS = (
    "چی داریم", "چی هست", "چیه", "چی داریم؟", "پیشنهاد بده", "به‌م بگو",
    "کیا هستن", "کی هستن", "چه کسانی هستن", "بگو", "بده", "لطفاً", "لطفا",
    "داریم", "هستن", "هست", "چی",
)


def _clean_title(raw):
    title = (raw or "").strip(" ؟?.!،,")
    changed = True
    while changed:
        changed = False
        for filler in _TITLE_FILLERS:
            if title.endswith(filler):
                title = title[: -len(filler)].strip(" ؟?.!،,")
                changed = True
    return title


def _fa_num(n):
    try:
        return f"{n:,}".replace(",", "٬")
    except (TypeError, ValueError):
        return str(n)


def _rating(r):
    return f"{r:.1f}" if r else "—"


def _card_line(c):
    year = c.get("year") or "—"
    genres = "، ".join(c.get("genres") or []) or "—"
    return f"«{c['title']}» ({year}) — امتیاز {_rating(c.get('rating'))} — {genres}"


def _detect_genres(text):
    found = []
    for key, names in {**GENRE_KEYWORDS, **MOOD_KEYWORDS}.items():
        if key in text:
            for n in names:
                if n not in found:
                    found.append(n)
    return found


def _detect_media_type(text):
    if "سریال" in text:
        return "series"
    if "فیلم" in text:
        return "movie"
    return "both"


def respond(message, history=None):
    text = (message or "").strip()
    low = text.lower()
    if not text:
        return {"reply": "سلام! چه فیلمی برای امشب مدنظرته؟", "titles": [], "tool": None}

    # --- سلام و احوال‌پرسی ساده ---
    if any(low == g or low.startswith(g + " ") for g in GREETINGS) and len(text) <= 20:
        return {
            "reply": "سلام! خوشحالم که اینجایی. امشب دنبال چه فیلمی یا سریالی هستی؟ چه ژانری دوست داری؟ مثلاً معمایی، اکشن، درام یا کمدی؟",
            "titles": [],
            "tool": None,
        }

    # --- مشابه: «شبیه اینسپشن» ---
    m = re.search(r"شبیه\s+(.+)", text)
    if m:
        title = _clean_title(m.group(1))
        result = tools.search_similar_titles(title)
        if result.get("found") and result["results"]:
            lines = [f"اگه از «{result['title']}» خوشت اومده، احتمالاً این‌ها هم برات جذابه:"]
            lines += [f"{i+1}. {_card_line(c)}" for i, c in enumerate(result["results"][:4])]
            return {"reply": "\n".join(lines), "titles": result["results"], "tool": "search_similar_titles"}
        return {
            "reply": f"«{title}» رو توی آرشیو مووی‌ورس پیدا نکردم که بر اساسش مشابه پیشنهاد بدم. اسم یه فیلم یا سریال دیگه رو بگو، یا بگو چه ژانری دوست داری؟",
            "titles": [],
            "tool": "search_similar_titles",
        }

    # --- مقایسه: «مقایسه اینسپشن و تنت» ---
    if "مقایسه" in text:
        rest = text.split("مقایسه", 1)[1].strip()
        parts = [_clean_title(p) for p in re.split(r"\s+(?:و|با|یا|در برابر)\s+", rest) if p.strip()]
        if len(parts) >= 2:
            result = tools.compare_titles(parts[:3])
            if len(result["items"]) >= 2:
                a, b = result["items"][0], result["items"][1]
                lines = [
                    f"مقایسه‌ی «{a['title']}» و «{b['title']}»:",
                    f"• {a['title']}: سال {a.get('year') or '—'}، امتیاز {_rating(a.get('rating'))}، ژانر: {'، '.join(a.get('genres') or []) or '—'}"
                    + (f"، مدت {a['runtime']} دقیقه" if a.get("runtime") else ""),
                    f"• {b['title']}: سال {b.get('year') or '—'}، امتیاز {_rating(b.get('rating'))}، ژانر: {'، '.join(b.get('genres') or []) or '—'}"
                    + (f"، مدت {b['runtime']} دقیقه" if b.get("runtime") else ""),
                ]
                lines.append("اگه بگی دنبال چه حسی هستی، می‌گم کدوم بیشتر به سلیقه‌ات می‌خوره.")
                return {"reply": "\n".join(lines), "titles": result["items"], "tool": "compare_titles"}
        return {
            "reply": "حتماً! اسم دو فیلمی که می‌خوای مقایسه کنم رو بگو؛ مثلاً: «مقایسه اینسپشن و تنت».",
            "titles": [],
            "tool": "compare_titles",
        }

    # --- جزئیات یک اثر: «درباره‌ی اینسپشن بگو» / «بازیگرای بریکینگ بد» ---
    detail_match = re.search(r"(?:درباره|در مورد|اطلاعات|جزئیات|معرفی)\s+(.+)", text)
    cast_match = re.search(r"(?:بازیگر|عوامل|کارگردان)\w*\s+(.+)", text)
    detail_title = None
    if detail_match:
        detail_title = _clean_title(detail_match.group(1))
    elif cast_match:
        detail_title = _clean_title(cast_match.group(1))
    if detail_title:
        media_type = _detect_media_type(text)
        details = tools.get_title_details(
            detail_title, media_type if media_type != "both" else None
        )
        if details.get("found"):
            lines = [f"«{details['title']}»" + (f" ({details['original_title']})" if details.get("original_title") else "")]
            meta = []
            if details.get("year"):
                meta.append(f"سال {details['year']}")
            if details.get("rating"):
                meta.append(f"امتیاز {_rating(details['rating'])}")
            if details.get("runtime"):
                meta.append(f"{details['runtime']} دقیقه")
            if details.get("seasons_count"):
                meta.append(f"{_fa_num(details['seasons_count'])} فصل")
            if meta:
                lines.append(" • ".join(meta))
            if details.get("genres"):
                lines.append(f"ژانر: {'، '.join(details['genres'])}")
            if details.get("directors"):
                lines.append(f"کارگردان: {'، '.join(details['directors'])}")
            if details.get("cast"):
                cast = "، ".join(c["name"] for c in details["cast"][:4])
                lines.append(f"بازیگران: {cast}")
            if details.get("description"):
                lines.append(details["description"][:280])
            return {"reply": "\n".join(lines), "titles": [details], "tool": "get_title_details"}
        return {
            "reply": f"«{detail_title}» رو توی آرشیو پیدا نکردم. مطمئنی اسمش رو درست نوشتی؟ یا بذار بر اساس ژانر بهت پیشنهاد بدم.",
            "titles": [],
            "tool": "get_title_details",
        }

    # --- پیشنهاد بر اساس ژانر/مود/دوره/امتیاز ---
    genres = _detect_genres(text)
    media_type = _detect_media_type(text)
    wants_recommendation = any(
        w in text for w in ("پیشنهاد", "معرفی کن", "معرفی", "می‌خوام", "میخوام", "بده", "خوب", "چی ببینم", "ببینم")
    )
    min_rating = 8.0 if ("امتیاز بالا" in text or "بهترین" in text) else None
    year_from = 2015 if "جدید" in text else None
    year_to = 2005 if ("قدیمی" in text or "کلاسیک" in text) else None

    if genres or (wants_recommendation and media_type != "both") or min_rating:
        result = tools.recommend_titles(
            genres=genres or None, media_type=media_type,
            min_rating=min_rating, year_from=year_from, year_to=year_to, limit=6,
        )
        if result["results"]:
            intro = "چند گزینه‌ی مناسب برات پیدا کردم:"
            if genres:
                intro = "با توجه به سلیقه‌ای که گفتی، این‌ها رو ببین:"
            lines = [intro]
            lines += [f"{i+1}. {_card_line(c)}" for i, c in enumerate(result["results"][:4])]
            lines.append("روی هر کارت بزنی می‌ری به صفحه‌ی خودش. خواستی دقیق‌تر بگم: فیلم می‌خوای یا سریال؟ محصول چه دوره‌ای باشه؟")
            return {"reply": "\n".join(lines), "titles": result["results"], "tool": "recommend_titles"}
        return {
            "reply": "با این ترکیب چیزی توی آرشیو پیدا نکردم. ژانر رو عوض کنیم یا شرط امتیاز/سال رو برداریم؟",
            "titles": [],
            "tool": "recommend_titles",
        }

    # --- جستجوی مستقیم عنوان (آخرین شانس: خود متن یک عنوان است) ---
    found = tools.search_movies(query=text, limit=3)["results"] + \
        tools.search_series(query=text, limit=3)["results"]
    if found:
        found.sort(key=lambda c: (c.get("rating") or 0), reverse=True)
        lines = ["این‌ها رو توی آرشیو پیدا کردم:"]
        lines += [f"{i+1}. {_card_line(c)}" for i, c in enumerate(found[:4])]
        lines.append("اگه درباره‌ی هرکدوم سؤالی داری بپرس؛ مثلاً «درباره‌ی اولی بگو».")
        return {"reply": "\n".join(lines), "titles": found[:6], "tool": "search_movies"}

    # --- نمی‌دانیم: سؤال پیگیری طبق شخصیت دستیار ---
    return {
        "reply": "حتماً کمکت می‌کنم یه گزینه‌ی خوب برای امشب پیدا کنی. بیشتر چه ژانری دوست داری؟ مثلاً معمایی، علمی‌تخیلی، اکشن یا درام؟ فیلم می‌خوای یا سریال؟",
        "titles": [],
        "tool": None,
    }
