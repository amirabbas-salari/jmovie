// ساخت خودکار sitemap.xml و robots.txt در زمان بیلد (Netlify).
//
// همه‌ی آدرس‌های عمومی سایت به‌همراه اسلاگ همه‌ی فیلم‌ها، سریال‌ها،
// کالکشن‌ها، ژانرها و بازیگران از API خوانده و در sitemap قرار
// می‌گیرد تا گوگل کل آرشیو را پیدا و ایندکس کند.
//
// متغیرها:
//   VITE_SITE_URL     دامنه‌ی فرانت (مثل https://movieverse.ir)
//   URL               دامنه‌ی خودکار Netlify (fallback)
//   VITE_API_BASE_URL آدرس بک‌اند برای خواندن اسلاگ‌ها
// اگر API در دسترس نباشد، فقط صفحات ثابت در sitemap می‌آید و بیلد
// هرگز به‌خاطر سئو fail نمی‌شود.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = (process.env.VITE_SITE_URL || process.env.URL || "")
  .replace(/\/+$/, "");
const API = (process.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");

const STATIC_ROUTES = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/movies", priority: "0.9", changefreq: "daily" },
  { path: "/series", priority: "0.9", changefreq: "daily" },
  { path: "/collection", priority: "0.8", changefreq: "weekly" },
  { path: "/pricing", priority: "0.5", changefreq: "monthly" },
  { path: "/support", priority: "0.4", changefreq: "monthly" },
  { path: "/faq", priority: "0.4", changefreq: "monthly" },
];

async function fetchAllSlugs(endpoint) {
  const slugs = [];
  if (!API) return slugs;
  let url = `${API}${endpoint}${endpoint.includes("?") ? "&" : "?"}page_size=100`;
  for (let page = 0; page < 500 && url; page += 1) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`${endpoint} -> HTTP ${res.status}`);
    const data = await res.json();
    const results = Array.isArray(data) ? data : data.results || [];
    for (const item of results) {
      if (item?.slug) {
        slugs.push({
          slug: item.slug,
          lastmod: item.updated_at || item.created_at || null,
        });
      }
    }
    url = data.next || null;
  }
  return slugs;
}

function urlEntry({ loc, lastmod, priority, changefreq }) {
  const parts = [`<loc>${loc}</loc>`];
  if (lastmod) parts.push(`<lastmod>${String(lastmod).slice(0, 10)}</lastmod>`);
  if (changefreq) parts.push(`<changefreq>${changefreq}</changefreq>`);
  if (priority) parts.push(`<priority>${priority}</priority>`);
  return `  <url>${parts.join("")}</url>`;
}

async function main() {
  if (!SITE) {
    console.warn(
      "[seo] VITE_SITE_URL/URL ست نشده؛ sitemap با دامنه‌ی نمونه ساخته می‌شود — در Netlify حتماً VITE_SITE_URL را ست کنید."
    );
  }
  const site = SITE || "https://example.com";

  const entries = STATIC_ROUTES.map((r) =>
    urlEntry({ loc: `${site}${r.path}`, priority: r.priority, changefreq: r.changefreq })
  );

  const sources = [
    { endpoint: "/movies/", prefix: "/movie/", priority: "0.8", changefreq: "weekly" },
    { endpoint: "/series/", prefix: "/series/", priority: "0.8", changefreq: "weekly" },
    { endpoint: "/collections/", prefix: "/collection/", priority: "0.7", changefreq: "weekly" },
    { endpoint: "/genres/", prefix: "/genre/", priority: "0.6", changefreq: "weekly" },
    { endpoint: "/people/", prefix: "/person/", priority: "0.5", changefreq: "monthly" },
  ];

  for (const src of sources) {
    try {
      const items = await fetchAllSlugs(src.endpoint);
      for (const item of items) {
        entries.push(
          urlEntry({
            loc: `${site}${src.prefix}${encodeURIComponent(item.slug)}`,
            lastmod: item.lastmod,
            priority: src.priority,
            changefreq: src.changefreq,
          })
        );
      }
      console.log(`[seo] ${src.endpoint}: ${items.length} URL`);
    } catch (err) {
      console.warn(`[seo] هشدار: خواندن ${src.endpoint} ناموفق بود (${err.message})؛ بدون آن ادامه می‌دهم.`);
    }
  }

  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");

  const robots = [
    "User-agent: *",
    "Allow: /",
    // صفحات خصوصی/کاربری و پنل نباید ایندکس شوند
    "Disallow: /admin/",
    "Disallow: /profile",
    "Disallow: /my-lists",
    "Disallow: /login",
    "Disallow: /register",
    "",
    `Sitemap: ${site}/sitemap.xml`,
    "",
  ].join("\n");

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, "sitemap.xml"), sitemap, "utf8");
  writeFileSync(resolve(OUT_DIR, "robots.txt"), robots, "utf8");
  console.log(`[seo] sitemap.xml (${entries.length} URL) و robots.txt ساخته شدند.`);
}

main().catch((err) => {
  // سئو نباید بیلد را بشکند
  console.warn(`[seo] خطا در ساخت sitemap نادیده گرفته شد: ${err.message}`);
});
