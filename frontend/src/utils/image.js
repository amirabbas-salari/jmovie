// انتخاب سایز مناسب تصویر TMDB بر اساس کاربرد: پوستر کارت‌ها نیازی به
// سایز اصلی (original/w780) ندارد؛ w342 برای کارت و w1280 برای بک‌گراند
// کافی است و حجم دانلود هر پوستر را چند برابر کم می‌کند.
// آدرس‌های غیر TMDB دست‌نخورده برمی‌گردند.
const TMDB_SIZE_RE = /(image\.tmdb\.org\/t\/p\/)(original|w\d+|h\d+)/

export function tmdbImage(url, size = "w342") {
  if (!url || typeof url !== "string") return url
  return url.replace(TMDB_SIZE_RE, `$1${size}`)
}

// srcset ریسپانسیو: مرورگر بر اساس عرض واقعی کارت و تراکم پیکسل دستگاه
// کوچک‌ترین سایز کافی را دانلود می‌کند (موبایل w185، دسکتاپ پرتراکم w500).
export function posterSrcSet(url) {
  if (!url || typeof url !== "string" || !TMDB_SIZE_RE.test(url)) return undefined
  return [185, 342, 500]
    .map((w) => `${tmdbImage(url, `w${w}`)} ${w}w`)
    .join(", ")
}

export const posterImage = (url) => tmdbImage(url, "w342")
export const backdropImage = (url) => tmdbImage(url, "w1280")

// برای هیرو: موبایل w780 می‌گیرد و دسکتاپ w1280؛ قبلاً همه w1280 می‌گرفتند.
export function backdropSrcSet(url) {
  if (!url || typeof url !== "string" || !TMDB_SIZE_RE.test(url)) return undefined
  return [780, 1280]
    .map((w) => `${tmdbImage(url, `w${w}`)} ${w}w`)
    .join(", ")
}

// آواتار بازیگران در UI حداکثر ۹۶px است؛ w185 روی TMDB کافی است.
export const profileImage = (url) => tmdbImage(url, "w185")
