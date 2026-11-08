// انتخاب سایز مناسب تصویر TMDB بر اساس کاربرد: پوستر کارت‌ها نیازی به
// سایز اصلی (original/w780) ندارد؛ w342 برای کارت و w1280 برای بک‌گراند
// کافی است و حجم دانلود هر پوستر را چند برابر کم می‌کند.
// آدرس‌های غیر TMDB دست‌نخورده برمی‌گردند.
export function tmdbImage(url, size = "w342") {
  if (!url || typeof url !== "string") return url
  return url.replace(
    /(image\.tmdb\.org\/t\/p\/)(original|w\d+|h\d+)/,
    `$1${size}`
  )
}

export const posterImage = (url) => tmdbImage(url, "w342")
export const backdropImage = (url) => tmdbImage(url, "w1280")
