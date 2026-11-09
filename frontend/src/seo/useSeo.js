import { useEffect } from "react";

import {
  DEFAULT_DESCRIPTION,
  DEFAULT_KEYWORDS,
  DEFAULT_OG_IMAGE,
  absoluteUrl,
} from "./site";

function upsertMeta(attr, key, content) {
  if (content == null || content === "") return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

const JSONLD_ID = "seo-jsonld";

/**
 * سئوی داینامیک هر صفحه (چون اپ SPA است، متاها سمت کلاینت ست می‌شوند و
 * گوگل هنگام رندر جاوااسکریپت آن‌ها را می‌خواند):
 * تایتل، دیسکریپشن، canonical، تگ‌های Open Graph / Twitter و JSON-LD.
 *
 * @param {object} opts
 * @param {string} opts.title - تایتل کامل صفحه
 * @param {string} [opts.description]
 * @param {string} [opts.keywords]
 * @param {string} [opts.path] - مسیر صفحه برای canonical (پیش‌فرض: مسیر فعلی)
 * @param {string} [opts.image] - تصویر OG (نسبی یا کامل)
 * @param {string} [opts.type] - og:type مثل website / video.movie
 * @param {boolean} [opts.noindex] - صفحات خصوصی/کاربری (پروفایل، ادمین…)
 * @param {object|object[]} [opts.jsonLd] - داده‌ی ساخت‌یافته schema.org
 */
export function useSeo({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords = DEFAULT_KEYWORDS,
  path,
  image,
  type = "website",
  noindex = false,
  jsonLd,
} = {}) {
  const jsonLdText = jsonLd ? JSON.stringify(jsonLd) : "";

  useEffect(() => {
    if (title) document.title = title;

    const canonical = absoluteUrl(path || window.location.pathname);
    const ogImage = absoluteUrl(image || DEFAULT_OG_IMAGE);

    upsertMeta("name", "description", description);
    upsertMeta("name", "keywords", keywords);
    upsertMeta(
      "name",
      "robots",
      noindex
        ? "noindex, nofollow"
        : "index, follow, max-image-preview:large, max-snippet:-1"
    );
    upsertCanonical(canonical);

    upsertMeta("property", "og:site_name", "مووی‌ورس");
    upsertMeta("property", "og:locale", "fa_IR");
    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:image", ogImage);

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", ogImage);

    if (jsonLdText) {
      let script = document.getElementById(JSONLD_ID);
      if (!script) {
        script = document.createElement("script");
        script.id = JSONLD_ID;
        script.type = "application/ld+json";
        document.head.appendChild(script);
      }
      script.textContent = jsonLdText;
    }

    return () => {
      // با خروج از صفحه، JSON-LD آن صفحه نباید روی صفحات دیگر بماند.
      document.getElementById(JSONLD_ID)?.remove();
    };
  }, [title, description, keywords, path, image, type, noindex, jsonLdText]);
}

export default useSeo;
