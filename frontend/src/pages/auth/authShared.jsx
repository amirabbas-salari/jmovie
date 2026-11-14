import { AlertCircle, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { BRAND, authInputCls } from "./authUtils";

// ---------------------------------------------------------------------------
// اینپوت‌های فرم احراز هویت
// ---------------------------------------------------------------------------
export function FieldError({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs text-red-300">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  );
}

export function TextField({ icon: Icon, error, ...props }) {
  return (
    <div>
      <div className="relative">
        <input {...props} aria-invalid={!!error} className={authInputCls(error)} />
        {Icon && (
          <Icon className="pointer-events-none absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/45" />
        )}
      </div>
      <FieldError message={error} />
    </div>
  );
}

export function PasswordField({ value, onChange, name = "password", placeholder = "رمز عبور", error, show, onToggleShow, autoComplete }) {
  return (
    <div>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          className={`${authInputCls(error)} ps-11`}
        />
        <button
          type="button"
          onClick={onToggleShow}
          aria-label={show ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
          className="absolute left-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
        </button>
      </div>
      <FieldError message={error} />
    </div>
  );
}

export function GeneralError({ message }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3.5 text-sm leading-6 text-red-200">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
      <span>{message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// شِل مشترک صفحات ورود/ثبت‌نام: پس‌زمینه‌ی سینمایی + کارت شیشه‌ای + تب‌ها
// ---------------------------------------------------------------------------
export default function AuthShell({ activeTab, image, imageAlt = "", title, subtitle, children }) {
  const navigate = useNavigate();
  return (
    <div dir="rtl" className="relative min-h-screen overflow-hidden bg-[#08040d] text-white">
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-fuchsia-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-rose-600/[0.14] blur-3xl" />

      <button
        type="button"
        onClick={() => navigate(-1)}
        className="absolute right-5 top-5 z-20 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-white/75 backdrop-blur transition hover:bg-black/60 hover:text-white"
      >
        <ArrowRight className="h-4 w-4" />
        بازگشت
      </button>

      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-10">
        {/* ستون فرم */}
        <div className="mx-auto w-full max-w-md">
          <Link to="/" className="mb-8 block text-center lg:text-start">
            <span className="text-4xl font-black tracking-tight">
              مووی<span className={`${BRAND} bg-clip-text text-transparent`}>ورس</span>
            </span>
          </Link>

          {/* تب ورود/ثبت‌نام */}
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/30 p-1.5">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className={`rounded-xl py-2.5 text-sm font-bold transition ${
                activeTab === "login" ? `${BRAND} text-white shadow-[0_10px_30px_rgba(225,29,72,0.3)]` : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              ورود
            </button>
            <button
              type="button"
              onClick={() => navigate("/register")}
              className={`rounded-xl py-2.5 text-sm font-bold transition ${
                activeTab === "register" ? `${BRAND} text-white shadow-[0_10px_30px_rgba(225,29,72,0.3)]` : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              ثبت‌نام
            </button>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8">
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 ${BRAND} opacity-80`} />
            <h1 className="text-2xl font-extrabold">{title}</h1>
            {subtitle && <p className="mt-2 text-sm leading-7 text-white/60">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>

          <p className="mt-6 text-center text-xs leading-6 text-white/40">
            با ورود یا ثبت‌نام، با قوانین استفاده از مووی‌ورس موافقت می‌کنید.
          </p>
        </div>

        {/* ستون تصویر */}
        <div className="relative hidden overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl lg:block">
          <img src={image} alt={imageAlt} className="h-[660px] w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#08040d] via-[#08040d]/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-8">
            <p className="text-xl font-extrabold leading-9">
              هزاران فیلم و سریال،
              <br />
              <span className={`${BRAND} bg-clip-text text-transparent`}>یک اشتراک فاصله داری</span>
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/80">
              {["دانلود با کیفیت‌های مختلف", "لیست تماشای شخصی", "دسترسی VIP به لینک‌ها"].map((t) => (
                <span key={t} className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5 backdrop-blur">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
