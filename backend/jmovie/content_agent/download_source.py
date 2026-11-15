"""برداشتن لینک‌های دانلود از سایت دوم کاربر.

اطلاعات فیلم/سریال فقط از TMDB می‌آید؛ این ماژول فقط «لینک دانلود» را از
سایت دومی که کاربر در تنظیمات ایجنت وارد می‌کند برمی‌دارد:

  ۱) صفحه‌ی اثر در سایت دوم پیدا می‌شود (جستجو با IMDb ID و عنوان —
     چند الگوی رایج جستجو امتحان می‌شود و بهترین نتیجه امتیاز می‌گیرد).
  ۲) از صفحه، لینک‌هایی که شبیه لینک دانلودند استخراج می‌شوند و از متن
     دوروبرشان کیفیت/حجم/زیرنویس/دوبله و شماره‌ی فصل/قسمت خوانده می‌شود.
  ۳) لینک‌ها به خود اثر (فیلم/سریال) یا قسمت درست سریال وصل می‌شوند.

هیچ ساختار خاصی از سایت فرض نمی‌شود؛ اگر صفحه‌ای پیدا نشود یا لینکی
نباشد، نتیجه‌ی خالی برمی‌گردد و واردکردن اثر از TMDB متوقف نمی‌شود.
"""
import logging
import re
from urllib.parse import quote_plus, urljoin, urlparse

import requests
from django.contrib.contenttypes.models import ContentType

logger = logging.getLogger(__name__)

USER_AGENT = "MovieVerseAgent/1.0 (+download link fetcher)"
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
SIZE_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*(GB|MB|TB|گیگابایت|مگابایت)", re.I)
EPISODE_RE = re.compile(r"[Ss](\d{1,2})[Ee](\d{1,3})")
EPISODE_ONLY_RE = re.compile(r"(?:قسمت|episode|ep\.?)\s*(\d{1,3})", re.I)
RESOLUTION_ORDER = ["2160p", "1440p", "1080p", "720p", "480p", "360p"]


def _session():
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})
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


def _quality_of(text):
    tokens = [t.lower().replace(" ", "").replace(".", "-") for t in QUALITY_RE.findall(text or "")]
    if not tokens:
        return ""
    resolution = next((r for r in RESOLUTION_ORDER if r in tokens), "")
    extras = [t for t in tokens if t not in RESOLUTION_ORDER]
    parts = ([resolution] if resolution else []) + extras[:2]
    return " ".join(p for p in parts if p).strip()


def extract_download_links(html, page_url):
    """از HTML یک صفحه، لینک‌های دانلود + متادیتای دوروبرشان را می‌خواند."""
    links = []
    seen = set()
    for href, text, tail in _anchors(html):
        if not href or href.startswith("#"):
            continue
        absolute = urljoin(page_url, href)
        if not absolute.startswith(("http://", "https://")):
            continue
        context = f"{text} {tail}"
        if not _is_download_href(absolute) and not QUALITY_RE.search(context):
            continue
        if not _is_download_href(absolute) and "/download" not in absolute.lower():
            # فقط با داشتن کیفیت در متن لینک قبول می‌کنیم که تبلیغ/منو نباشد
            if len(text) < 3:
                continue
        if absolute in seen:
            continue
        seen.add(absolute)

        episode_match = EPISODE_RE.search(context) or EPISODE_RE.search(absolute)
        season = episode = None
        if episode_match:
            season, episode = int(episode_match.group(1)), int(episode_match.group(2))
        else:
            ep_only = EPISODE_ONLY_RE.search(context)
            if ep_only:
                episode = int(ep_only.group(1))

        size_match = SIZE_RE.search(context)
        dubbed = bool(re.search(r"دوبله|dubbed", context, re.I))
        subtitled = bool(re.search(r"زیرنویس|subtitle|softsub|سافت", context, re.I))
        links.append({
            "url": absolute,
            "title": text[:255],
            "quality": _quality_of(context) or "نامشخص",
            "size": (f"{size_match.group(1)} {size_match.group(2)}" if size_match else ""),
            "language": "دوبله فارسی" if dubbed else ("زیرنویس فارسی" if subtitled else "original"),
            "subtitle": subtitled,
            "season": season,
            "episode": episode,
        })
    return links


def _title_tokens(title):
    return {t for t in re.split(r"[^a-z0-9]+", (title or "").lower()) if len(t) >= 3}


def find_title_pages(session, base_url, *, imdb_id="", original_title="", title="", year=None):
    """بهترین صفحه‌های اثر در سایت دوم را برمی‌گرداند (حداکثر چند URL)."""
    base_url = (base_url or "").strip().rstrip("/")
    if not base_url:
        return []
    base_host = urlparse(base_url).netloc

    queries = []
    if imdb_id:
        queries.append(imdb_id)
    if original_title:
        queries.append(f"{original_title} {year}" if year else original_title)
    if title and title != original_title:
        queries.append(title)

    search_patterns = ["/?s={q}", "/search/{q}", "/search/{q}/"]
    scored = {}

    for query in queries:
        for pattern in search_patterns:
            search_url = base_url + pattern.format(q=quote_plus(query))
            try:
                html, final_url = fetch_html(session, search_url)
            except Exception:
                continue
            # بعضی سایت‌ها با یک نتیجه مستقیم به صفحه‌ی اثر ریدایرکت می‌کنند
            if urlparse(final_url).path not in ("", "/") and "s=" not in final_url and "search" not in final_url:
                if imdb_id and imdb_id in html:
                    scored[final_url] = scored.get(final_url, 0) + 5
            tokens = _title_tokens(original_title or title)
            for href, text, _tail in _anchors(html):
                if not href or href.startswith("#"):
                    continue
                absolute = urljoin(final_url, href)
                parsed = urlparse(absolute)
                if parsed.netloc and parsed.netloc != base_host:
                    continue
                haystack = f"{absolute} {text}".lower()
                score = 0
                if imdb_id and imdb_id.lower() in haystack:
                    score += 5
                score += sum(1 for t in tokens if t in haystack)
                if year and str(year) in haystack:
                    score += 1
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
        _obj, was_created = Download.objects.get_or_create(
            content_type=content_type,
            object_id=target.id,
            url=link["url"],
            defaults={
                "title": link.get("title") or "",
                "quality": link.get("quality") or "نامشخص",
                "size": link.get("size") or "",
                "language": link.get("language") or "original",
                "subtitle": bool(link.get("subtitle")),
                "is_active": True,
            },
        )
        created += int(was_created)
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
        all_links.extend(extract_download_links(html, final_url))
    # حذف تکراری بین صفحه‌ها
    unique = {link["url"]: link for link in all_links}
    created = attach_downloads(media, media_type, list(unique.values())) if unique else 0
    return {"pages": len(pages), "found": len(unique), "created": created}
