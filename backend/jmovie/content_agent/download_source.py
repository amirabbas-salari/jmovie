"""برداشتن لینک‌های دانلود از سایت دوم کاربر.

اطلاعات فیلم/سریال فقط از TMDB می‌آید؛ این ماژول فقط «لینک دانلود» را از
سایت دومی که کاربر در تنظیمات ایجنت وارد می‌کند برمی‌دارد:

  ۱) صفحه‌ی اثر در سایت دوم پیدا می‌شود (جستجو با IMDb ID و عنوان انگلیسی
     و فارسی — چند الگوی رایج جستجو امتحان می‌شود و بهترین نتیجه با
     تطبیق واژه‌های عنوان فارسی/انگلیسی امتیاز می‌گیرد).
  ۲) از صفحه، لینک‌هایی که شبیه لینک دانلودند استخراج می‌شوند و از متن
     دوروبرشان کیفیت/حجم/زیرنویس/دوبله و شماره‌ی فصل/قسمت خوانده می‌شود.
     اگر در صفحه‌ی اثر لینک مستقیمی نباشد، دکمه‌ی «دانلود» تا یک سطح
     دنبال می‌شود (صفحه‌ی دانلود جدا).
  ۳) لینک‌ها برای فیلم به خود فیلم و برای سریال فقط به قسمت درست وصل
     می‌شوند؛ لینک بی‌قسمت (مثل تریلر) دانلود سریال حساب نمی‌شود و
     صفحه‌های جدا‌ی قسمت‌ها هم دنبال می‌شوند.

هیچ ساختار خاصی از سایت فرض نمی‌شود؛ اگر صفحه‌ای پیدا نشود یا لینکی
نباشد، نتیجه‌ی خالی برمی‌گردد و واردکردن اثر از TMDB متوقف نمی‌شود.
"""
import logging
import re
from urllib.parse import quote_plus, unquote, urljoin, urlparse

import requests
from django.contrib.contenttypes.models import ContentType

logger = logging.getLogger(__name__)

# هدر شبیه مرورگر واقعی؛ خیلی از سایت‌ها (و فایروال‌ها) به User-Agent
# ربات‌گونه پاسخ 403 می‌دهند و جستجو خالی برمی‌گردد.
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fa,en-US;q=0.8,en;q=0.7",
}
TIMEOUT = 20
MAX_CANDIDATE_PAGES = 2
# سقف صفحه‌های جدا‌ی قسمت‌ها که برای یک سریال دنبال می‌شود
MAX_EPISODE_PAGES = 100

MEDIA_EXTENSIONS = (".mkv", ".mp4", ".avi", ".mov", ".wmv", ".zip", ".rar", ".7z")
SKIP_HREF_PARTS = (
    "telegram", "t.me/", "whatsapp", "twitter.com/intent", "facebook.com/sharer",
    "instagram.com", "/cdn-cgi/", "javascript:", "mailto:", "#",
)
QUALITY_RE = re.compile(
    r"(2160p|1440p|1080p|720p|480p|360p|4k|uhd|bluray|blu-ray|web[-. ]?dl|webrip|hdrip|brrip|x265|x264|hevc|10bit)",
    re.I,
)
SIZE_RE = re.compile(r"(\d+(?:[.,٫]\d+)?)\s*(GB|MB|TB|گیگابایت|مگابایت)", re.I)
EPISODE_RE = re.compile(r"[Ss](\d{1,2})[Ee](\d{1,3})")
EPISODE_ONLY_RE = re.compile(r"(?:قسمت|episode|ep\.?)\s*(\d{1,3})", re.I)
RESOLUTION_ORDER = ["2160p", "1440p", "1080p", "720p", "480p", "360p"]
URL_RE = re.compile(r"https?://[^\s\"'<>)\]]+")
# واژه‌هایی که در تقریباً همه‌ی نتایج جستجوی سایت‌های دانلود هستند و
# برای تشخیص اثر خاصی ارزشی ندارند
STOP_TOKENS = {"the", "a", "an", "and", "of", "in", "دانلود", "فیلم", "سریال"}


def _session():
    session = requests.Session()
    session.headers.update(BROWSER_HEADERS)
    return session


def fetch_html(session, url):
    response = session.get(url, timeout=TIMEOUT)
    response.raise_for_status()
    if not response.encoding or response.encoding.lower() == "iso-8859-1":
        response.encoding = response.apparent_encoding or "utf-8"
    return response.text, response.url


def _strip_tags(html_fragment):
    text = re.sub(r"<[^>]+>", " ", html_fragment or "")
    return re.sub(r"\s+", " ", text).strip()


def _normalize(text):
    """نرمال‌سازی برای تطبیق عنوان‌ها: نیم‌فاصله، ی/ک عربی، نویسه‌های اضافی."""
    text = (text or "").lower()
    text = text.replace("‌", " ").replace(" ", " ")
    text = text.replace("ي", "ی").replace("ك", "ک").replace("ة", "ه").replace("ؤ", "و")
    text = re.sub(r"[^a-z0-9\u0600-\u06FF]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _anchors(html):
    """[(href, text, tail_text)] از همه‌ی تگ‌های a صفحه."""
    results = []
    pattern = re.compile(
        # بخش بعد از لینک نباید از تگ a بعدی رد شود (وگرنه لینک‌ها بلعیده می‌شوند)
        r"<a\s[^>]*href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>((?:(?!</?a\b).){0,180})",
        re.I | re.S,
    )
    for href, inner, tail in pattern.findall(html or ""):
        results.append((href.strip(), _strip_tags(inner), _strip_tags(tail)))
    return results


def _is_download_href(href):
    low = href.lower()
    if any(part in low for part in SKIP_HREF_PARTS):
        return False
    path = urlparse(href).path.lower()
    return path.endswith(MEDIA_EXTENSIONS) or "/download" in path or "dl." in urlparse(href).netloc


_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
RES_RE = re.compile(r"(2160p|1440p|1080p|720p|576p|480p|360p)", re.I)
SOURCE_RE = re.compile(r"(bluray|blu-ray|brrip|web[-. ]?dl|webrip|hdrip|hdcam|hdts|dvdrip)", re.I)
SOURCE_CANON = {
    "bluray": "BluRay", "blu-ray": "BluRay", "brrip": "BRRip",
    "web-dl": "WEB-DL", "webdl": "WEB-DL", "web dl": "WEB-DL",
    "webrip": "WEBRip", "hdrip": "HDRip", "hdcam": "HDCAM",
    "hdts": "HDTS", "dvdrip": "DVDRip",
}
DUBBED_RE = re.compile(r"دوبله|dubbed|\bdub\b|farsi\s*dub|persian\s*dub", re.I)
SUBTITLE_RE = re.compile(r"زیرنویس|subtitle|softsub|hardsub|subbed|farsi\s*sub|persian\s*sub", re.I)
NO_SUBTITLE_RE = re.compile(r"بدون\s*زیرنویس|no\s*subtitle|without\s*subtitle", re.I)


def _en_digits(text):
    return (text or "").translate(_DIGITS)


def _quality_label(text, anchor_text=""):
    """برچسب تمیز کیفیت از یک متن: مثل «1080p BluRay x265» یا «720p WEB-DL».

    اشاره‌های کیفیت (رزولوشن/منبع/کدک) خوشه‌بندی می‌شوند و خوشه‌ای انتخاب
    می‌شود که به متن خود لینک نزدیک‌تر است؛ وگرنه وقتی چند ردیف دانلود
    پشت سر هم‌اند، منبعِ ردیف بعدی به این لینک نسبت داده می‌شود.
    """
    low = _en_digits(text or "").lower()
    mentions = []  # (start, end, kind, value)
    for m in RES_RE.finditer(low):
        mentions.append((m.start(), m.end(), "res", m.group(1).lower()))
    for m in re.finditer(r"4k|uhd", low):
        mentions.append((m.start(), m.end(), "res", "2160p"))
    for m in re.finditer(r"full\s*hd", low):
        mentions.append((m.start(), m.end(), "res", "1080p"))
    src_spans = []
    for m in SOURCE_RE.finditer(low):
        token = m.group(1).lower().replace(".", "-")
        mentions.append((m.start(), m.end(), "src", SOURCE_CANON.get(token, m.group(1))))
        src_spans.append((m.start(), m.end()))
    for m in re.finditer(r"\bhd\b", low):
        if not any(s <= m.start() < e for s, e in src_spans):
            mentions.append((m.start(), m.end(), "res", "720p"))
    for m in re.finditer(r"x265|hevc|10\s?bit", low):
        mentions.append((m.start(), m.end(), "codec", "x265"))
    if not mentions:
        return ""

    # هر رزولوشن گروه خودش است؛ منبع/کدک به نزدیک‌ترین رزولوشن می‌چسبد.
    # (خوشه‌بندی ساده کافی نبود: وقتی برچسب‌ها فشرده‌اند، منبع ردیف بعدی
    # وارد گروه این لینک می‌شد.)
    res_mentions = [m for m in mentions if m[2] == "res"]
    groups = [[m] for m in res_mentions]
    if groups:
        for mention in mentions:
            if mention[2] == "res":
                continue
            nearest = min(
                groups,
                key=lambda g: min(abs(mention[0] - g[0][1]), abs(mention[0] - g[0][0])),
            )
            nearest.append(mention)
    else:
        groups = [list(mentions)]
    for group in groups:
        group.sort(key=lambda x: x[0])

    anchor_pos = low.find(anchor_text.lower()) if anchor_text else -1

    def _distance(group):
        if anchor_pos < 0:
            return group[0][0]
        center = (group[0][0] + group[-1][1]) / 2
        return abs(center - anchor_pos)

    best = min(groups, key=_distance)
    resolution = next((v for _s, _e, k, v in best if k == "res"), "")
    source = next((v for _s, _e, k, v in best if k == "src"), "")
    codec = "x265" if any(k == "codec" for _s, _e, k, _v in best) else ""
    return " ".join(p for p in (resolution, source, codec) if p)


def _dubbed_subtitled(text):
    if NO_SUBTITLE_RE.search(text or ""):
        subtitled = False
    else:
        subtitled = bool(SUBTITLE_RE.search(text or ""))
    return bool(DUBBED_RE.search(text or "")), subtitled


EN_SEASON_EPISODE_RE = re.compile(r"season\s*(\d{1,2})\D{0,12}episode\s*(\d{1,3})", re.I)

# لینک تریلر/تیزر «لینک دانلود» نیست؛ روی خیلی از سایت‌ها تنها فایل ویدیوییِ
# صفحه‌ی سریال همان تریلر است و اگر فیلتر نشود ایجنت فقط تریلر را برمی‌دارد.
TRAILER_RE = re.compile(r"trailer|teaser|تریلر|تیزر|آنونس|پیش.?نمایش", re.I)


def _is_trailer_link(url, text=""):
    low_url = unquote(url or "").lower().replace("-", " ").replace("_", " ").replace(".", " ")
    if "trailer" in low_url or "teaser" in low_url:
        return True
    return bool(TRAILER_RE.search(text or ""))


# شماره‌های حروفی فارسی برای «قسمت اول»، «فصل دوم» و مانند آن
FA_ORDINALS = {
    "اول": 1, "نخست": 1, "دوم": 2, "سوم": 3, "چهارم": 4, "پنجم": 5,
    "ششم": 6, "هفتم": 7, "هشتم": 8, "نهم": 9, "دهم": 10,
    "یازدهم": 11, "دوازدهم": 12, "سیزدهم": 13, "چهاردهم": 14, "پانزدهم": 15,
    "شانزدهم": 16, "هفدهم": 17, "هجدهم": 18, "نوزدهم": 19, "بیستم": 20,
}
_FA_NUM = r"\d{1,3}|" + "|".join(sorted(FA_ORDINALS, key=len, reverse=True))


def _fa_number(token):
    token = (token or "").strip()
    if token.isdigit():
        return int(token)
    return FA_ORDINALS.get(token)


def _season_episode_of(text):
    """(فصل, قسمت) را از یک متن/آدرس می‌خواند؛ هر جزء می‌تواند None باشد.

    الگوها: ‎S01E02‎، «فصل ۲ قسمت ۵»، «قسمت اول»، season/episode انگلیسی.
    """
    t = _en_digits(text or "").replace("‌", " ").replace("ي", "ی").replace("ك", "ک")
    t = re.sub(r"\s+", " ", t)
    m = EPISODE_RE.search(t)
    if m:
        return int(m.group(1)), int(m.group(2))
    m = re.search(r"فصل\s*(" + _FA_NUM + r")\s*قسمت\s*(" + _FA_NUM + r")", t)
    if m:
        return _fa_number(m.group(1)), _fa_number(m.group(2))
    m = EN_SEASON_EPISODE_RE.search(t)
    if m:
        return int(m.group(1)), int(m.group(2))
    episode = None
    m = re.search(r"قسمت\s*(" + _FA_NUM + r")", t)
    if m:
        episode = _fa_number(m.group(1))
    else:
        m = EPISODE_ONLY_RE.search(t)
        if m:
            episode = int(m.group(1))
    season = None
    m = re.search(r"فصل\s*(" + _FA_NUM + r")", t)
    if m:
        season = _fa_number(m.group(1))
    else:
        m = re.search(r"\bseason\s*(\d{1,2})", t, re.I)
        if m:
            season = int(m.group(1))
    return season, episode


def _make_link(url, text, context, pre_context=""):
    # اسم فایل داخل URL مطمئن‌ترین منبع کیفیت/دوبله است؛ بعد متن خود لینک
    # و بعد متن دوروبر آن (برچسب‌های قبل و بعد از لینک در همان باکس/ردیف).
    url_text = _en_digits(unquote(url)).replace(".", " ").replace("_", " ").replace("-", " ")
    meta_text = _en_digits(f"{text} {context}")
    quality = (
        _quality_label(url_text)
        or _quality_label(text)
        or _quality_label(context, anchor_text=text)
        or "نامشخص"
    )
    combined = f"{url_text} {meta_text}"
    dubbed, subtitled = _dubbed_subtitled(combined)

    # شماره‌ی قسمت به ترتیب اطمینان: اسم فایل، متن لینک، برچسبِ قبل از لینک.
    # متنِ بعد از لینک عمداً اینجا نیست؛ در فهرست‌های گروهی معمولاً برچسب
    # ردیف بعدی است و لینک را به قسمت اشتباه می‌چسباند (در extract، اگر
    # هیچ‌کدام نبود، با احتیاط سراغش می‌رویم).
    season = episode = None
    for probe in (url_text, _en_digits(text or ""), pre_context):
        s, e = _season_episode_of(probe)
        if season is None and s is not None:
            season = s
        if e is not None:
            episode = e
            break

    size_match = SIZE_RE.search(meta_text)
    return {
        "url": url,
        "title": (text or "")[:255],
        # قرارداد نمایش سایت: زبان فقط «original» (زبان اصلی) یا «دوبله
        # فارسی» است و زیرنویس با فیلد جدا مشخص می‌شود؛ مقدارهایی مثل
        # «زیرنویس فارسی» در کارت دانلود اشتباه «دوبله» نمایش داده می‌شوند.
        "quality": quality,
        "size": (f"{size_match.group(1).replace('٫', '.')} {size_match.group(2)}" if size_match else ""),
        "language": "دوبله فارسی" if dubbed else "original",
        "subtitle": subtitled,
        "season": season,
        "episode": episode,
    }


def _anchor_spans(html):
    """[(href, text, start, end)] با موقعیت هر لینک در HTML."""
    pattern = re.compile(r"<a\s[^>]*href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>", re.I | re.S)
    return [
        (m.group(1).strip(), _strip_tags(m.group(2)), m.start(), m.end())
        for m in pattern.finditer(html or "")
    ]


def extract_download_links(html, page_url):
    """از HTML یک صفحه، لینک‌های دانلود + متادیتای دوروبرشان را می‌خواند."""
    html = html or ""
    links = []
    seen = set()

    def add(url, text, context, cur_season=None, cur_episode=None,
            pre_context="", post_context=""):
        if url in seen:
            return
        seen.add(url)
        link = _make_link(url, text, context, pre_context=pre_context)
        # در فهرست‌های گروهی («قسمت ۳:» و بعد چند کیفیت پشت سر هم) فقط لینک
        # اول شماره‌ی قسمت را در متن دوروبرش دارد؛ شماره از برچسب ردیف به
        # بقیه‌ی لینک‌های همان ردیف هم می‌رسد.
        if link.get("episode") is None and cur_episode is not None:
            link["episode"] = cur_episode
            if link.get("season") is None:
                link["season"] = cur_season
        elif link.get("episode") is None and post_context:
            # آخرین شانس: برچسب بعد از لینک («دانلود» قسمت ۳)؛ فقط وقتی
            # داخل ردیفِ برچسب‌دار نیستیم، چون آنجا برچسبِ ردیف بعدی است.
            s_post, e_post = _season_episode_of(post_context)
            if e_post is not None:
                link["episode"] = e_post
                if link.get("season") is None:
                    link["season"] = s_post
        if link.get("season") is None and cur_season is not None:
            link["season"] = cur_season
        links.append(link)

    spans = _anchor_spans(html)
    chrome = _chrome_flags(html, spans)
    current_season = None
    current_episode = None
    for i, (href, text, start, end) in enumerate(spans):
        if chrome[i]:
            continue  # ناوبری/ستون کناری/پاصفحه لینک دانلود این اثر نیست
        if not href or href.startswith("#"):
            continue
        absolute = urljoin(page_url, href)
        if not absolute.startswith(("http://", "https://")):
            continue
        # کانتکست = متن همان باکس/ردیف: از پایان لینک قبلی تا شروع لینک
        # بعدی (سقف‌دار)؛ برچسب کیفیت معمولاً قبل از دکمه‌ی دانلود است و
        # نباید از ردیف همسایه نشت کند.
        prev_end = spans[i - 1][3] if i else max(0, start - 800)
        next_start = spans[i + 1][2] if i + 1 < len(spans) else min(len(html), end + 800)
        context = _strip_tags(html[prev_end:next_start])
        # برچسب ردیف («فصل ۲» / «قسمت ۵:») درست قبل از لینک‌های همان ردیف
        # می‌آید؛ برای لینک‌های بعدیِ ردیف نگهش می‌داریم.
        pre_text = _strip_tags(html[prev_end:start])
        post_text = _strip_tags(html[end:next_start])
        s_mark, e_mark = _season_episode_of(pre_text[-150:])
        if e_mark is not None:
            current_episode = e_mark
            if s_mark is not None:
                current_season = s_mark
        elif s_mark is not None:
            current_season = s_mark
            current_episode = None
        if _is_trailer_link(absolute, text):
            continue
        if not _is_download_href(absolute):
            if "/download" not in absolute.lower() and not QUALITY_RE.search(f"{text} {context}"):
                continue
            if len(text) < 3 and not QUALITY_RE.search(context):
                continue
        add(absolute, text, context, current_season, current_episode,
            pre_context=pre_text[-150:], post_context=post_text)

    # بعضی سایت‌ها لینک فایل را به‌صورت متن خام یا در اسکریپت/اتریبیوت می‌گذارند
    for match in URL_RE.finditer(html):
        url = match.group(0).rstrip(".,;")
        if not urlparse(url).path.lower().endswith(MEDIA_EXTENSIONS):
            continue
        if any(part in url.lower() for part in SKIP_HREF_PARTS):
            continue
        if _is_trailer_link(url):
            continue
        context = _strip_tags(html[max(0, match.start() - 300): match.end() + 300])
        add(url, "", context, pre_context=context)
    return links


def _heading_text(html):
    """متن تیتر صفحه: ‎<title>‎ و تیترهای h1/h2 (نه کل بدنه).

    برای سنجش تعلق صفحه به سریال فقط تیتر معتبر است؛ متن کامل بدنه پر
    است از منو و ستون کناری که نام سریال‌های دیگر (و این سریال) در آن
    هست و سنجش را خراب می‌کند.
    """
    parts = []
    for pattern in (r"<title[^>]*>(.*?)</title>", r"<h[12][^>]*>(.*?)</h[12]>"):
        for match in re.finditer(pattern, html or "", re.I | re.S):
            parts.append(_strip_tags(match.group(1)))
    return " ".join(parts)


def _title_match(haystack_norm, en_tokens, fa_tokens):
    """عنوان سریال (فارسی/انگلیسی) در متن نرمال‌شده هست؟

    تطابق کامل، یا برای عنوان چندواژه‌ای تطابق قویِ بخشی (سایت‌ها اغلب
    نام کوتاه‌تر می‌گذارند)؛ سریال خارجی عملاً هیچ واژه‌ی خاصی ندارد.
    """
    for tokens in (en_tokens, fa_tokens):
        if not tokens:
            continue
        matched = sum(1 for token in tokens if token in haystack_norm)
        if matched == len(tokens):
            return True
        if len(tokens) >= 3 and matched >= 2 and matched / len(tokens) >= 0.6:
            return True
    return False


_PATH_GENERIC_TOKENS = {
    "download", "series", "tv", "movie", "film", "watch", "post", "page",
}


def _slug_key_tokens(page_url):
    """واژه‌های کلیدی اسلاگ صفحه‌ی سریال از آدرس خودش (مثل test-show).

    قوی‌ترین نشانه‌ی تعلق صفحه‌های قسمت همین است: آدرس قسمت‌ها تقریباً
    همیشه اسلاگ پست سریال را در خود دارد، مستقل از اینکه عنوان TMDB
    یا نام نمایشی سایت چه باشد.
    """
    best = set()
    for segment in urlparse(page_url).path.split("/"):
        tokens = {
            t for t in _normalize(unquote(segment)).split()
            if len(t) >= 2 and t not in STOP_TOKENS
            and t not in _PATH_GENERIC_TOKENS and not t.isdigit()
        }
        if len(tokens) > len(best):
            best = tokens
    return best


_TAG_RE = re.compile(r"<(/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>", re.S)
_VOID_TAGS = {"br", "hr", "img", "input", "meta", "link", "source", "wbr"}
_CHROME_TAGS = {"aside", "nav", "footer", "header"}
_CHROME_HINTS = ("sidebar", "side-bar", "sidbar", "widget")


def _chrome_flags(html, spans, use_hints=False):
    """برای هر انکر: داخل ناوبری/ستون کناری/پاصفحه‌ی سایت هست یا نه.

    لینک‌های داخل این بخش‌ها (مثل «قسمت‌های تازه‌ی سریال‌های دیگر»)
    لینک دانلود این اثر نیستند و نباید استخراج یا دنبال شوند.
    """
    flags = [False] * len(spans)
    if not spans:
        return flags
    stack = []  # [(tag, is_chrome)]
    idx = 0
    starts = [s[2] for s in spans]

    def flag_upto(pos):
        nonlocal idx
        chrome = any(is_chrome for _tag, is_chrome in stack)
        while idx < len(spans) and starts[idx] < pos:
            flags[idx] = chrome
            idx += 1

    for match in _TAG_RE.finditer(html or ""):
        flag_upto(match.start())
        closing, tag, attrs = match.group(1), match.group(2).lower(), match.group(3) or ""
        if tag in _VOID_TAGS:
            continue
        if closing:
            for i in range(len(stack) - 1, -1, -1):
                if stack[i][0] == tag:
                    del stack[i:]
                    break
        elif not attrs.rstrip().endswith("/"):
            low = attrs.lower()
            chrome = tag in _CHROME_TAGS or (
                use_hints and any(hint in low for hint in _CHROME_HINTS)
            )
            stack.append((tag, chrome))
    flag_upto(len(html or "") + 1)
    return flags


def _download_page_candidates(html, page_url, limit=MAX_CANDIDATE_PAGES):
    """لینک «صفحه‌ی دانلود» جدا (دکمه‌ی دانلود) برای دنبال‌کردن یک سطح."""
    host = urlparse(page_url).netloc
    out = []
    spans = _anchor_spans(html)
    flags = _chrome_flags(html, spans, use_hints=True)
    for (href, text, _start, _end), in_chrome in zip(spans, flags):
        if in_chrome:
            continue
        if not href or href.startswith("#"):
            continue
        absolute = urljoin(page_url, href)
        parsed = urlparse(absolute)
        if parsed.netloc and parsed.netloc != host:
            continue
        if parsed.path.lower().endswith(MEDIA_EXTENSIONS):
            continue
        if _is_trailer_link(absolute, text):
            continue
        if "دانلود" in text or "download" in text.lower() or "/download" in absolute.lower():
            if absolute not in out:
                out.append(absolute)
        if len(out) >= limit:
            break
    return out


def _episode_page_candidates(html, page_url):
    """[(url, season, episode)] صفحه‌های جدا‌ی هر قسمت برای دنبال‌کردن.

    در سایت‌های دانلود، صفحه‌ی سریال معمولاً برای هر قسمت یک دکمه/لینک
    جدا دارد («دانلود قسمت ۳») که لینک‌های مستقیم داخل صفحه‌ی خود قسمت‌اند.
    شماره‌ی فصل/قسمت از متن یا آدرس همان لینک خوانده می‌شود تا لینک‌های
    صفحه‌ی قسمت (که اغلب اسم مبهم دارند) به قسمت درست وصل شوند.
    """
    host = urlparse(page_url).netloc
    # واژه‌های اسلاگ خود صفحه‌ی سریال (مثل test-show از /show/test-show/)؛
    # لینک‌های زیر همان خانواده‌ی اسلاگ (قسمت‌ها و فصل‌های همین سریال)
    # حتی اگر متنشان فقط عنوان قسمت باشد هم کاندیدای دنبال‌کردن‌اند.
    generic_path_tokens = {
        "series", "tv", "show", "movie", "film", "episode", "episodes",
        "season", "watch", "download", "post", "page",
    }
    own_tokens = {
        t for t in _normalize(unquote(urlparse(page_url).path)).split()
        if len(t) >= 2 and t not in STOP_TOKENS and t not in generic_path_tokens
        and not t.isdigit()
    }
    out = []
    seen = set()
    spans = _anchor_spans(html)
    flags = _chrome_flags(html, spans, use_hints=True)
    for i, ((href, text, _start, end), in_chrome) in enumerate(zip(spans, flags)):
        if in_chrome:
            continue  # ستون کناری/ناوبری: قسمت‌های سریال‌های دیگر است
        if not href or href.startswith("#"):
            continue
        absolute = urljoin(page_url, href)
        parsed = urlparse(absolute)
        if parsed.netloc and parsed.netloc != host:
            continue
        if parsed.path.lower().endswith(MEDIA_EXTENSIONS):
            continue
        if _is_trailer_link(absolute, text):
            continue
        next_start = spans[i + 1][2] if i + 1 < len(spans) else end + 400
        tail = _strip_tags(html[end:next_start])[:180]
        # متن قبل از لینک هم مهم است: در جدول‌های قسمت‌ها شماره‌ی قسمت
        # معمولاً سلول/برچسب قبل از دکمه‌ی «دانلود» است، نه بعدش.
        prev_end = spans[i - 1][3] if i else max(0, _start - 800)
        pre = _strip_tags(html[prev_end:_start])[-180:]
        label = f"{pre} {text} {tail}"
        season, episode = _season_episode_of(f"{unquote(absolute)} {label}")
        href_tokens = set(_normalize(unquote(absolute)).split())
        in_family = bool(own_tokens) and own_tokens <= href_tokens
        looks_episode = (
            episode is not None
            or "قسمت" in label
            or "episode" in label.lower()
            or "/episode" in parsed.path.lower()
            or in_family
        )
        # صفحه‌ی فصل («دانلود فصل ۱») هم کاندیداست؛ قسمت‌هایش یک سطح
        # عمیق‌تر از داخل خودش خوانده می‌شوند.
        looks_season = episode is None and (
            season is not None
            or "فصل" in label
            or "season" in label.lower()
            or "/season" in parsed.path.lower()
        )
        if not (looks_episode or looks_season) or absolute in seen:
            continue
        seen.add(absolute)
        out.append((absolute, season, episode))
        if len(out) >= MAX_EPISODE_PAGES:
            break
    return out


def _title_tokens(title):
    return {
        t for t in _normalize(title).split()
        if len(t) >= 2 and t not in STOP_TOKENS
    }


def _score_candidate(norm_haystack, *, imdb_id, en_tokens, fa_tokens, year):
    score = 0
    if imdb_id and imdb_id in norm_haystack:
        score += 10
    for tokens in (en_tokens, fa_tokens):
        if not tokens:
            continue
        matched = sum(1 for t in tokens if t in norm_haystack)
        score += matched
        if matched and matched == len(tokens):
            score += 2  # همه‌ی واژه‌های عنوان پیدا شد
    if year and str(year) in norm_haystack:
        score += 1
    return score


def find_title_pages(session, base_url, *, imdb_id="", original_title="", title="", year=None):
    """بهترین صفحه‌های اثر در سایت دوم را برمی‌گرداند (حداکثر چند URL)."""
    base_url = (base_url or "").strip().rstrip("/")
    if not base_url:
        return []
    base_host = urlparse(base_url).netloc
    imdb_id = (imdb_id or "").strip().lower()
    en_tokens = _title_tokens(original_title)
    fa_tokens = _title_tokens(title)

    queries = []
    if imdb_id:
        queries.append(imdb_id)
    if original_title:
        if year:
            queries.append(f"{original_title} {year}")
        queries.append(original_title)
    if title and title != original_title:
        queries.append(title)

    search_patterns = ["/?s={q}", "/search/{q}", "/search/{q}/", "/search?q={q}"]
    scored = {}

    for query in queries:
        for pattern in search_patterns:
            search_url = base_url + pattern.format(q=quote_plus(query))
            try:
                html, final_url = fetch_html(session, search_url)
            except Exception:
                continue
            # بعضی سایت‌ها با یک نتیجه مستقیم به صفحه‌ی اثر ریدایرکت می‌کنند
            final_path = urlparse(final_url).path
            if final_path not in ("", "/") and "s=" not in final_url and "search" not in final_url:
                page_score = _score_candidate(
                    _normalize(_strip_tags(html)),
                    imdb_id=imdb_id, en_tokens=en_tokens, fa_tokens=fa_tokens, year=year,
                )
                if page_score >= 3:
                    scored[final_url] = max(scored.get(final_url, 0), page_score + 5)
            for href, text, _tail in _anchors(html):
                if not href or href.startswith("#"):
                    continue
                absolute = urljoin(final_url, href)
                parsed = urlparse(absolute)
                if parsed.netloc and parsed.netloc != base_host:
                    continue
                if parsed.path in ("", "/"):
                    continue  # خانه/منو نتیجه نیست
                haystack = _normalize(f"{unquote(absolute)} {text}")
                score = _score_candidate(
                    haystack,
                    imdb_id=imdb_id, en_tokens=en_tokens, fa_tokens=fa_tokens, year=year,
                )
                if score >= 2:
                    scored[absolute] = max(scored.get(absolute, 0), score)
            if scored:
                break
        if scored:
            break

    ranked = sorted(scored.items(), key=lambda kv: kv[1], reverse=True)
    return [url for url, _score in ranked[:MAX_CANDIDATE_PAGES]]


def _resolve_series_episode(episode_index, link):
    """قسمت متناظر یک لینک سریال از روی (فصل، قسمت)؛ وگرنه None.

    اگر فصل معلوم نیست، وقتی شماره‌ی قسمت در کل سریال یکتا باشد (مثلاً
    فقط فصل دوم قسمت ۵ دارد) همان انتخاب می‌شود؛ اگر چند فصل آن شماره
    را دارند، حدس نمی‌زنیم.
    """
    episode_no = link.get("episode")
    if not episode_no:
        return None
    season_no = link.get("season")
    if season_no is not None:
        return episode_index.get((season_no, episode_no))
    matches = [ep for (_s, e), ep in episode_index.items() if e == episode_no]
    return matches[0] if len(matches) == 1 else None


def _series_episode_index(series):
    index = {}
    for season in series.seasons.all():
        for episode in season.episodes.all():
            index[(season.season_number, episode.episode_number)] = episode
    return index


def attach_downloads(media, media_type, links):
    """لینک‌ها را به فیلم یا قسمت درست سریال وصل می‌کند؛ تعداد ساخته‌شده.

    برای سریال فقط لینک‌هایی وصل می‌شوند که شماره‌ی قسمتشان معلوم است و
    آن قسمت در سایت وجود دارد؛ لینک بی‌قسمت به خود آبجکت سریال وصل نمی‌شود.
    """
    from downloads.models import Download

    # نوع مدیا از TMDB ممکن است "tv" باشد؛ هر دو یعنی سریال
    is_series = media_type in ("series", "tv")
    episode_index = _series_episode_index(media) if is_series else {}

    def target_for(link):
        if is_series:
            # لینک دانلود سریال متعلق به قسمت‌هاست، نه خود سریال: لینکی که
            # به قسمت مشخصی نمی‌رسد (مثل تریلر یا لینک کلی صفحه) وصل نمی‌شود.
            return _resolve_series_episode(episode_index, link)
        return media

    created = 0
    for link in links:
        target = target_for(link)
        if target is None:
            continue
        content_type = ContentType.objects.get_for_model(target.__class__)
        values = {
            "title": link.get("title") or "",
            "quality": link.get("quality") or "نامشخص",
            "size": link.get("size") or "",
            "language": link.get("language") or "original",
            "subtitle": bool(link.get("subtitle")),
            "is_active": True,
        }
        obj, was_created = Download.objects.get_or_create(
            content_type=content_type,
            object_id=target.id,
            url=link["url"],
            defaults=values,
        )
        created += int(was_created)
        if not was_created:
            # تلاش دوباره باید متادیتای قبلیِ اشتباه را هم اصلاح کند
            changed = [
                field for field, value in values.items()
                if getattr(obj, field) != value
            ]
            if changed:
                for field in changed:
                    setattr(obj, field, values[field])
                obj.save(update_fields=changed)
    return created


def scrape_downloads(base_url, media, media_type, *, imdb_id="", original_title="", title="", year=None):
    """جریان کامل: پیدا کردن صفحه → استخراج لینک → وصل‌کردن. خلاصه برمی‌گرداند."""
    session = _session()
    is_series = media_type in ("series", "tv")
    pages = find_title_pages(
        session, base_url,
        imdb_id=imdb_id, original_title=original_title, title=title, year=year,
    )
    en_tokens = _title_tokens(original_title)
    fa_tokens = _title_tokens(title)
    # کلید اسلاگ از آدرس صفحه‌های پیداشده‌ی این سریال (اگر پیدا شده
    # باشد)؛ محکم‌ترین نشانه‌ی تعلق صفحه‌های قسمت به همین سریال است،
    # مستقل از عنوانی که TMDB دارد و نامی که سایت گذاشته.
    slug_key = set()
    for found_url in pages:
        slug_key = max(slug_key, _slug_key_tokens(found_url), key=len)

    def page_belongs_to_series(page_html, page_url):
        """صفحه‌ی دنبال‌شده واقعاً مال همین سریال است؟

        هویت صفحه باید ساختاری باشد، نه متن کامل بدنه: صفحه‌های سایت‌های
        دانلود پر است از منو و ستون کناری که نام این سریال و سریال‌های
        دیگر در آن هست؛ سنجش روی متن بدنه هم سریال خارجی را قبول می‌کند
        هم صفحه‌ی درست را رد. پس: IMDb، یا اسلاگ خود سریال در آدرس، یا
        تطابق عنوان در تیتر صفحه (title/h1) — اسلاگ/تیتر همیشه نام خود
        اثر را دارد، نه نام آثار ستون کناری.
        """
        if not is_series:
            return True
        url_norm = _normalize(unquote(page_url))
        if imdb_id and imdb_id.lower() in url_norm.lower():
            return True
        if imdb_id and imdb_id.lower() in (page_html or "").lower():
            return True
        if slug_key and slug_key <= set(url_norm.split()):
            return True
        heading = _normalize(f"{url_norm} {_heading_text(page_html)}")
        return _title_match(heading, en_tokens, fa_tokens)

    def page_links_belong(links):
        """نام فایل‌های دانلود داخل صفحه مال این سریال‌اند؟

        صفحه‌ی قسمت خیلی از سایت‌ها آدرس عددی و تیتر کلی («دانلود قسمت
        ۱») دارد؛ اما نام فایل‌های داخلش (Test.Show.S01E01.720p.mkv یا
        مسیر .../test-show/...) نام خود سریال را دارد. این هم نشانه‌ی
        ساختاری است: فایل سریال خارجی نام همان سریال را دارد، نه این را.
        """
        for link in links:
            url_norm = _normalize(unquote(link["url"]))
            if slug_key and slug_key <= set(url_norm.split()):
                return True
            if _title_match(url_norm, en_tokens, fa_tokens):
                return True
        return False

    # شمارنده‌های مرحله‌ای؛ تا وقتی «هیچ لینکی پیدا نشد» دقیقاً معلوم
    # باشد لینک‌ها در کدام مرحله حذف شده‌اند و پیام خطا همان را بگوید.
    stats = {
        "series_pages_accepted": 0,
        "episode_candidates": 0,
        "episode_pages_accepted": 0,
        "episode_pages_rejected": 0,
        "links_extracted": 0,
        "imported_episodes": 0,
    }

    def episode_candidate_priority(candidate):
        # صفحه‌هایی که اسلاگشان عنوان همین سریال را دارد اول دنبال شوند؛
        # لینک‌های ستون کناری (سریال‌های دیگر) ته صف می‌مانند.
        url = candidate[0]
        slug = _normalize(unquote(url))
        if imdb_id and imdb_id.lower() in url.lower():
            return 0
        if slug_key and slug_key <= set(slug.split()):
            return 0
        return 0 if any(
            tokens and all(token in slug for token in tokens)
            for tokens in (en_tokens, fa_tokens)
        ) else 1

    all_links = []
    fetched = set(pages)
    for page_url in pages:
        try:
            html, final_url = fetch_html(session, page_url)
        except Exception:
            logger.warning("download source page failed: %s", page_url, exc_info=True)
            continue
        fetched.add(final_url)
        # اگر صفحه‌ی پیداشده اصلاً مال این سریال نیست (مثلاً صفحه‌ی فهرست
        # آثار)، لینک‌های مستقیمش به این سریال نمی‌چسبند؛ صفحه‌های قسمت
        # از رویش همچنان دنبال می‌شوند ولی تک‌تک راستی‌آزمایی خواهند شد.
        page_links = extract_download_links(html, final_url)
        if page_belongs_to_series(html, final_url) or page_links_belong(page_links):
            links = page_links
            stats["series_pages_accepted"] += 1
        else:
            links = []
        if is_series:
            # لینک دانلود سریال روی قسمت‌هاست و معمولاً هر قسمت صفحه‌ی جدا
            # دارد؛ صفحه‌ی هر قسمت دنبال می‌شود و لینک‌هایش با شماره‌ی
            # همان قسمت (از لینک ارجاع‌دهنده) برچسب می‌خورند. صفحه‌ی فصل
            # هم ممکن است واسط باشد؛ قسمت‌هایش یک سطح عمیق‌تر خوانده
            # می‌شوند (سقف عمق ۲، تا خزیدن بی‌نهایت نشود).
            foreign = {"count": 0}

            def follow_episode_pages(from_html, from_url, depth):
                found_links = []
                candidates = sorted(
                    _episode_page_candidates(from_html, from_url),
                    key=episode_candidate_priority,
                )
                if depth == 0:
                    stats["episode_candidates"] += len(candidates)
                for ep_url, ep_season, ep_episode in candidates:
                    if foreign["count"] >= 8:
                        break
                    if ep_url in fetched:
                        continue
                    fetched.add(ep_url)
                    try:
                        sub_html, sub_final = fetch_html(session, ep_url)
                    except Exception:
                        continue
                    sub_links = extract_download_links(sub_html, sub_final)
                    if not (
                        page_belongs_to_series(sub_html, sub_final)
                        or page_links_belong(sub_links)
                    ):
                        # به‌احتمال زیاد لینک ستون کناریِ سریال دیگری است؛
                        # بعد از چند مورد از این‌ها دیگر ادامه نمی‌دهیم.
                        stats["episode_pages_rejected"] += 1
                        foreign["count"] += 1
                        continue
                    stats["episode_pages_accepted"] += 1
                    if not sub_links:
                        # صفحه‌ی قسمت هم ممکن است فقط دکمه‌ی «دانلود» داشته باشد
                        for dl_url in _download_page_candidates(sub_html, sub_final):
                            if dl_url in fetched:
                                continue
                            fetched.add(dl_url)
                            try:
                                dl_html, dl_final = fetch_html(session, dl_url)
                            except Exception:
                                continue
                            dl_links = extract_download_links(dl_html, dl_final)
                            if not (
                                page_belongs_to_series(dl_html, dl_final)
                                or page_links_belong(dl_links)
                            ):
                                continue
                            sub_links.extend(dl_links)
                            if sub_links:
                                break
                    if depth < 2:
                        # صفحه‌ی فصل/واسط: «لینک»های استخراج‌شده‌اش ممکن است
                        # خودِ صفحه‌های قسمت باشند (روی هاست dl.* هر انکری
                        # شبیه لینک دانلود دیده می‌شود)؛ آن‌ها دانلود نیستند
                        # و باید دنبال شوند، نه اینکه وصل شوند.
                        inner_urls = {
                            c[0] for c in _episode_page_candidates(sub_html, sub_final)
                        }
                        own_links = [
                            link for link in sub_links if link["url"] not in inner_urls
                        ]
                        if len(own_links) != len(sub_links) or not own_links:
                            sub_links = own_links + follow_episode_pages(
                                sub_html, sub_final, depth + 1
                            )
                    for link in sub_links:
                        if link.get("episode") is None and ep_episode is not None:
                            link["episode"] = ep_episode
                            if link.get("season") is None:
                                link["season"] = ep_season
                        elif link.get("season") is None and ep_season is not None:
                            link["season"] = ep_season
                        found_links.append(link)
                return found_links

            links.extend(follow_episode_pages(html, final_url, 0))
        if not links or is_series:
            # صفحه‌ی اثر گاهی فقط دکمه‌ی «دانلود» دارد و لینک‌ها صفحه‌ی جدا
            # هستند؛ برای سریال این صفحه (فهرست همه‌ی قسمت‌ها) حتی وقتی روی
            # صفحه‌ی اصلی چند لینک هست هم دنبال می‌شود.
            for sub_url in _download_page_candidates(
                html, final_url, limit=4 if is_series else MAX_CANDIDATE_PAGES
            ):
                if sub_url in fetched:
                    continue
                fetched.add(sub_url)
                try:
                    sub_html, sub_final = fetch_html(session, sub_url)
                except Exception:
                    continue
                dl_links = extract_download_links(sub_html, sub_final)
                if not (
                    page_belongs_to_series(sub_html, sub_final)
                    or page_links_belong(dl_links)
                ):
                    continue
                links.extend(dl_links)
                if links and not is_series:
                    break
        all_links.extend(links)
    # حذف تکراری بین صفحه‌ها؛ آدرس صفحه‌هایی که دنبال شدند (صفحه‌ی قسمت یا
    # دانلود) خودش «لینک دانلود» نیست، هرچند روی هاست dl.* استخراج شده باشد.
    unique = {link["url"]: link for link in all_links if link["url"] not in fetched}
    stats["links_extracted"] = len(unique)
    if is_series:
        # برای سریال فقط لینکی شمرده می‌شود که به قسمتی می‌رسد که واقعاً
        # در سایت هست؛ لینک بی‌قسمت (تریلر) یا قسمتِ واردنشده «لینک
        # دانلود» حساب نمی‌شود تا سریال الکی «دارای لینک» منتشر نشود.
        episode_index = _series_episode_index(media)
        stats["imported_episodes"] = len(episode_index)
        unique = {
            url: link for url, link in unique.items()
            if _resolve_series_episode(episode_index, link) is not None
        }
    created = attach_downloads(media, media_type, list(unique.values())) if unique else 0
    result = {
        "pages": len(pages), "found": len(unique), "created": created,
        "stats": stats,
    }
    if not unique:
        if not pages:
            result["reason"] = "صفحه‌ی این اثر در سایت دوم پیدا نشد؛ جستجو با IMDb و عنوان (انگلیسی و فارسی) نتیجه‌ای نداشت."
        elif is_series:
            # پیام دقیقِ همان مرحله‌ای که لینک‌ها در آن حذف شدند، نه یک
            # پیام کلی؛ تا ادمین بداند مشکل از سایت دوم است یا از داده‌ی ما.
            if stats["imported_episodes"] == 0:
                result["reason"] = "قسمت‌های این سریال هنوز در سایت ما ثبت نشده‌اند (فصل/قسمت از TMDB ساخته نشده)؛ لینک دانلود جایی برای وصل‌شدن ندارد."
            elif stats["links_extracted"]:
                result["reason"] = (
                    f"لینک دانلود پیدا شد ({stats['links_extracted']}) اما شماره‌ی قسمت هیچ‌کدام "
                    f"با {stats['imported_episodes']} قسمت ثبت‌شده‌ی این سریال جور نشد."
                )
            elif stats["episode_pages_accepted"]:
                result["reason"] = "صفحه‌های قسمت این سریال در سایت دوم پیدا و تأیید شدند، اما داخلشان لینک دانلود خوانایی نبود."
            elif stats["episode_candidates"]:
                result["reason"] = (
                    f"روی صفحه‌ی سریال {stats['episode_candidates']} صفحه‌ی قسمت بود، اما هیچ‌کدام "
                    "مال این سریال تشخیص داده نشدند (اسلاگ/تیتر صفحه و نام فایل‌هایشان با این سریال نخواند)."
                )
            elif not stats["series_pages_accepted"]:
                result["reason"] = "صفحه‌ی پیداشده در سایت دوم مال این سریال تشخیص داده نشد و لینک قسمتی هم روی آن نبود."
            else:
                result["reason"] = "صفحه‌ی سریال در سایت دوم پیدا و تأیید شد، اما روی آن هیچ لینک دانلود یا صفحه‌ی قسمتی خوانده نشد؛ احتمالاً فهرست قسمت‌ها با جاوااسکریپت بارگذاری می‌شود یا ساختار صفحه با الگوهای فعلی نمی‌خواند."
            result["reason"] += (
                f" (تشخیص: صفحه‌ی سریال قبول‌شده {stats['series_pages_accepted']}، "
                f"کاندیدای قسمت {stats['episode_candidates']}، صفحه‌ی قسمت قبول‌شده "
                f"{stats['episode_pages_accepted']}، ردشده {stats['episode_pages_rejected']}، "
                f"لینک استخراج‌شده {stats['links_extracted']}، قسمت ثبت‌شده {stats['imported_episodes']})"
            )
        else:
            result["reason"] = "صفحه‌ی اثر در سایت دوم پیدا شد، اما لینک دانلودی از آن خوانده نشد."
    return result
