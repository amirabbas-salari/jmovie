// اطلاعات مرکزی سایت برای سئو — آدرس دامنه از VITE_SITE_URL خوانده
// می‌شود (در Netlify ست کنید، مثل https://movieverse.ir) و اگر نبود از
// دامنه‌ی فعلی مرورگر استفاده می‌شود تا canonicalها همیشه درست باشند.
export const SITE_NAME = "مووی‌ورس";
export const SITE_NAME_EN = "MovieVerse";
export const SITE_TAGLINE = "دانلود و تماشای آنلاین فیلم و سریال";
export const DEFAULT_DESCRIPTION =
  "مووی‌ورس — دانلود و تماشای آنلاین فیلم و سریال خارجی با زیرنویس فارسی، کیفیت‌های متنوع 480p تا 4K، لینک مستقیم و آرشیو کامل به‌روزترین فیلم‌ها و سریال‌های دنیا.";
export const DEFAULT_KEYWORDS =
  "دانلود فیلم, دانلود سریال, تماشای آنلاین فیلم, فیلم با زیرنویس فارسی, دانلود فیلم جدید, سریال خارجی, مووی‌ورس";
export const DEFAULT_OG_IMAGE = "/Logo-red.svg";
export const THEME_COLOR = "#08040d";

export function siteOrigin() {
  const fromEnv = import.meta.env.VITE_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** مسیر نسبی را به URL کامل روی دامنه‌ی سایت تبدیل می‌کند. */
export function absoluteUrl(path = "/") {
  if (!path) return siteOrigin() || "/";
  if (/^https?:\/\//i.test(path)) return path;
  const origin = siteOrigin();
  const clean = path.startsWith("/") ? path : `/${path}`;
  return origin ? `${origin}${clean}` : clean;
}

export function brandTitle(pageTitle) {
  return pageTitle ? `${pageTitle} | ${SITE_NAME}` : `${SITE_NAME} | ${SITE_TAGLINE}`;
}
