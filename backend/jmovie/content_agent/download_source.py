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
  ۳) لینک‌ها به خود اثر (فیلم/سریال) یا قسمت درست سریال وصل می‌شوند.

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


FA_SEASON_EPISODE_RE = re.compile(r"فصل\s*(\d{1,2})\s*قسمت\s*(\d{1,3})")
EN_SEASON_EPISODE_RE = re.compile(r"season\s*(\d{1,2})\D{0,12}episode\s*(\d{1,3})", re.I)


def _make_link(url, text, context):
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

    season = episode = None
    episode_match = (
        EPISODE_RE.search(combined)
        or FA_SEASON_EPISODE_RE.search(meta_text)
        or EN_SEASON_EPISODE_RE.search(combined)
    )
    if episode_match:
        season, episode = int(episode_match.group(1)), int(episode_match.group(2))
    else:
        ep_only = EPISODE_ONLY_RE.search(meta_text) or EPISODE_ONLY_RE.search(url_text)
        if ep_only:
            episode = int(ep_only.group(1))

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

    def add(url, text, context):
        if url in seen:
            return
        seen.add(url)
        links.append(_make_link(url, text, context))

    spans = _anchor_spans(html)
    for i, (href, text, start, end) in enumerate(spans):
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
        if not _is_download_href(absolute):
            if "/download" not in absolute.lower() and not QUALITY_RE.search(f"{text} {context}"):
                continue
            if len(text) < 3 and not QUALITY_RE.search(context):
                continue
        add(absolute, text, context)

    # بعضی سایت‌ها لینک فایل را به‌صورت متن خام یا در اسکریپت/اتریبیوت می‌گذارند
    for match in URL_RE.finditer(html):
        url = match.group(0).rstrip(".,;")
        if not urlparse(url).path.lower().endswith(MEDIA_EXTENSIONS):
            continue
        if any(part in url.lower() for part in SKIP_HREF_PARTS):
            continue
        context = _strip_tags(html[max(0, match.start() - 300): match.end() + 300])
        add(url, "", context)
    return links


def _download_page_candidates(html, page_url):
    """لینک «صفحه‌ی دانلود» جدا (دکمه‌ی دانلود) برای دنبال‌کردن یک سطح."""
    host = urlparse(page_url).netloc
    out = []
    for href, text, _tail in _anchors(html):
        if not href or href.startswith("#"):
            continue
        absolute = urljoin(page_url, href)
        parsed = urlparse(absolute)
        if parsed.netloc and parsed.netloc != host:
            continue
        if parsed.path.lower().endswith(MEDIA_EXTENSIONS):
            continue
        if "دانلود" in text or "download" in text.lower() or "/download" in absolute.lower():
            if absolute not in out:
                out.append(absolute)
        if len(out) >= MAX_CANDIDATE_PAGES:
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


def attach_downloads(media, media_type, links):
    """لینک‌ها را به فیلم/سریال یا قسمت درست وصل می‌کند؛ تعداد ساخته‌شده."""
    from downloads.models import Download

    # نوع مدیا از TMDB ممکن است "tv" باشد؛ هر دو یعنی سریال
    is_series = media_type in ("series", "tv")
    episode_index = {}
    if is_series:
        for season in media.seasons.all():
            for episode in season.episodes.all():
                episode_index[(season.season_number, episode.episode_number)] = episode
    seasons_present = {s for s, _e in episode_index}

    def target_for(link):
        if is_series and link.get("episode"):
            season_no = link.get("season")
            if season_no is None and len(seasons_present) == 1:
                season_no = next(iter(seasons_present))
            episode = episode_index.get((season_no, link["episode"]))
            if episode is not None:
                return episode
        return media

    created = 0
    for link in links:
        target = target_for(link)
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
    pages = find_title_pages(
        session, base_url,
        imdb_id=imdb_id, original_title=original_title, title=title, year=year,
    )
    all_links = []
    for page_url in pages:
        try:
            html, final_url = fetch_html(session, page_url)
        except Exception:
            logger.warning("download source page failed: %s", page_url, exc_info=True)
            continue
        links = extract_download_links(html, final_url)
        if not links:
            # صفحه‌ی اثر گاهی فقط دکمه‌ی «دانلود» دارد و لینک‌ها صفحه‌ی جدا هستند
            for sub_url in _download_page_candidates(html, final_url):
                try:
                    sub_html, sub_final = fetch_html(session, sub_url)
                except Exception:
                    continue
                links.extend(extract_download_links(sub_html, sub_final))
                if links:
                    break
        all_links.extend(links)
    # حذف تکراری بین صفحه‌ها
    unique = {link["url"]: link for link in all_links}
    created = attach_downloads(media, media_type, list(unique.values())) if unique else 0
    result = {"pages": len(pages), "found": len(unique), "created": created}
    if not unique:
        result["reason"] = (
            "صفحه‌ی این اثر در سایت دوم پیدا نشد؛ جستجو با IMDb و عنوان (انگلیسی و فارسی) نتیجه‌ای نداشت."
            if not pages
            else "صفحه‌ی اثر در سایت دوم پیدا شد، اما لینک دانلودی از آن خوانده نشد."
        )
    return result
