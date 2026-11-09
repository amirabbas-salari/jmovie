"""sitemap.xml و robots.txt داینامیک.

آدرس‌های داخل sitemap مربوط به فرانت‌اند هستند؛ دامنه از FRONTEND_BASE_URL
خوانده می‌شود (مثل https://movieverse.ir) و اگر ست نباشد از دامنه‌ی
همین درخواست استفاده می‌شود. پاسخ یک ساعت کش می‌شود تا با هر بازدید
ربات گوگل، دیتابیس زیر بار نرود.
"""
import os
from xml.sax.saxutils import escape

from django.core.cache import cache
from django.http import HttpResponse
from django.views.decorators.cache import cache_page

STATIC_ROUTES = [
    ("/", "1.0", "daily"),
    ("/movies", "0.9", "daily"),
    ("/series", "0.9", "daily"),
    ("/collection", "0.8", "weekly"),
    ("/pricing", "0.5", "monthly"),
    ("/support", "0.4", "monthly"),
    ("/faq", "0.4", "monthly"),
]

CACHE_KEY = "seo:sitemap:v1"


def _frontend_base(request):
    env_base = os.getenv("FRONTEND_BASE_URL", "").rstrip("/")
    if env_base:
        return env_base
    return f"{request.scheme}://{request.get_host()}"


def _url(base, path, priority, changefreq, lastmod=None):
    parts = [f"<loc>{escape(base + path)}</loc>"]
    if lastmod is not None:
        parts.append(f"<lastmod>{lastmod.date().isoformat()}</lastmod>")
    parts.append(f"<changefreq>{changefreq}</changefreq>")
    parts.append(f"<priority>{priority}</priority>")
    return "<url>" + "".join(parts) + "</url>"


def _build_sitemap(base):
    from collection.models import Collection
    from genres.models import Genre
    from movies.models import Movie
    from people.models import Person
    from series.models import Series

    urls = [
        _url(base, path, priority, freq)
        for path, priority, freq in STATIC_ROUTES
    ]

    sources = [
        (Movie.objects.order_by("id").values_list("slug", "updated_at"), "/movie/", "0.8", "weekly"),
        (Series.objects.order_by("id").values_list("slug", "updated_at"), "/series/", "0.8", "weekly"),
        (Collection.objects.order_by("id").values_list("slug", "updated_at"), "/collection/", "0.7", "weekly"),
        (Genre.objects.order_by("id").values_list("slug", "updated_at"), "/genre/", "0.6", "weekly"),
        (Person.objects.order_by("id").values_list("slug", "updated_at"), "/person/", "0.5", "monthly"),
    ]
    for queryset, prefix, priority, freq in sources:
        for slug, updated_at in queryset.iterator(chunk_size=500):
            if slug:
                urls.append(_url(base, f"{prefix}{slug}", priority, freq, updated_at))

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        + "".join(urls)
        + "</urlset>"
    )


@cache_page(60 * 60)
def sitemap_view(request):
    base = _frontend_base(request)
    cache_key = f"{CACHE_KEY}:{base}"
    content = cache.get(cache_key)
    if content is None:
        content = _build_sitemap(base)
        cache.set(cache_key, content, 60 * 60)
    return HttpResponse(content, content_type="application/xml")


def robots_view(request):
    base = _frontend_base(request)
    lines = [
        "User-agent: *",
        "Allow: /",
        "Disallow: /admin/",
        "Disallow: /django-admin/",
        "Disallow: /api/",
        "Disallow: /accounts/",
        "",
        f"Sitemap: {base}/sitemap.xml",
        "",
    ]
    return HttpResponse("\n".join(lines), content_type="text/plain")
