// هلپرهای غیرکامپوننتی صفحات ورود/ثبت‌نام (در فایل جدا تا قانون
// react-refresh فقط-کامپوننت راضی باشد).
export const BRAND = "bg-[linear-gradient(135deg,#fb7185,#e11d48_48%,#9333ea)]";

// ---------------------------------------------------------------------------
// ترجمه و استخراج خطاهای API احراز هویت — تا کاربر همیشه پیام فارسی و
// واضح ببیند (رمز اشتباه، نام کاربری تکراری، ایمیل نامعتبر و…).
// ---------------------------------------------------------------------------
const MESSAGE_FA = [
  ["No active account found", "نام کاربری یا رمز عبور اشتباه است."],
  ["Unable to log in with provided credentials", "نام کاربری یا رمز عبور اشتباه است."],
  ["already exists", "قبلاً ثبت شده است؛ اگر حساب دارید وارد شوید."],
  ["This field is required", "این فیلد الزامی است."],
  ["may not be blank", "این فیلد الزامی است."],
  ["Enter a valid email", "ایمیل معتبر نیست."],
  ["Enter a valid username", "نام کاربری معتبر نیست؛ فقط حروف، عدد و @ . + - _ مجاز است."],
  ["too short", "خیلی کوتاه است."],
  ["too common", "خیلی رایج و قابل حدس است؛ رمز دیگری انتخاب کنید."],
  ["entirely numeric", "نمی‌تواند فقط از عدد تشکیل شده باشد."],
  ["too similar", "بیش از حد شبیه اطلاعات شخصی شماست."],
];

export const translateServerMessage = (msg) => {
  const text = String(msg ?? "");
  for (const [key, fa] of MESSAGE_FA) {
    if (text.toLowerCase().includes(key.toLowerCase())) return fa;
  }
  return text;
};

export function parseApiErrors(err, fallback = "خطایی رخ داد؛ دوباره تلاش کنید.") {
  const res = err?.response;
  if (!res) {
    return { general: "ارتباط با سرور برقرار نشد؛ اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.", fields: {} };
  }
  if (res.status === 429) {
    return { general: "تعداد تلاش‌ها زیاد شده است؛ چند دقیقه صبر کنید و دوباره تلاش کنید.", fields: {} };
  }
  const data = res.data;
  if (!data || typeof data !== "object") return { general: fallback, fields: {} };
  if (data.detail) return { general: translateServerMessage(data.detail), fields: {} };
  const fields = {};
  let general = "";
  for (const [key, value] of Object.entries(data)) {
    const msgs = (Array.isArray(value) ? value : [value]).map((m) => translateServerMessage(m));
    if (key === "non_field_errors") general = msgs.join(" ");
    else fields[key] = msgs.join(" ");
  }
  return { general, fields };
}

export const authInputCls = (hasError) =>
  `w-full rounded-2xl border bg-white/[0.05] px-4 py-3.5 pe-11 text-sm text-white outline-none placeholder:text-white/35 transition focus:bg-white/[0.08] focus:ring-2 ${
    hasError
      ? "border-red-400/60 focus:border-red-400/70 focus:ring-red-500/20"
      : "border-white/10 focus:border-rose-400/50 focus:ring-rose-500/20"
  }`;

// سنجش قدرت رمز: طول + تنوع نویسه‌ها
export function passwordStrength(password) {
  if (!password) return { score: 0, label: "", width: "0%", color: "bg-white/10" };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const levels = [
    { label: "خیلی ضعیف", color: "bg-red-500" },
    { label: "ضعیف", color: "bg-red-400" },
    { label: "متوسط", color: "bg-amber-400" },
    { label: "خوب", color: "bg-lime-400" },
    { label: "عالی", color: "bg-emerald-400" },
    { label: "عالی", color: "bg-emerald-400" },
  ];
  const level = levels[Math.min(score, 5)];
  return { score, label: level.label, width: `${Math.max(8, (score / 5) * 100)}%`, color: level.color };
}
