import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  HelpCircle,
  Megaphone,
  ShieldCheck,
  Send,
  Film,
  Tv,
  LibraryBig,
  LifeBuoy,
  Heart,
  UserRound,
} from "lucide-react";
import {
  FaInstagram,
  FaTelegramPlane,
  FaYoutube,
  FaLinkedinIn,
  FaFacebookF,
} from "react-icons/fa";

// لینک‌های شبکه‌های اجتماعی
const socials = [
  { Icon: FaInstagram, href: "#", label: "اینستاگرام" },
  { Icon: FaTelegramPlane, href: "#", label: "تلگرام" },
  { Icon: FaYoutube, href: "#", label: "یوتیوب" },
  { Icon: FaLinkedinIn, href: "#", label: "لینکدین" },
  { Icon: FaFacebookF, href: "#", label: "فیسبوک" },
];

// ستون‌های دسترسی سریع — فقط مسیرهایی که واقعاً در سایت وجود دارند
const columns = [
  {
    title: "دسترسی سریع",
    links: [
      { Icon: Film, text: "فیلم‌ها", to: "/movies" },
      { Icon: Tv, text: "سریال‌ها", to: "/series" },
      { Icon: LibraryBig, text: "مجموعه‌ها", to: "/collection" },
    ],
  },
  {
    title: "راهنما",
    links: [
      { Icon: HelpCircle, text: "سوالات متداول", to: "/faq" },
      { Icon: LifeBuoy, text: "پشتیبانی", to: "/support" },
      { Icon: ShieldCheck, text: "حریم خصوصی و قوانین", to: "/faq" },
    ],
  },
  {
    title: "مووی‌ورس",
    links: [
      { Icon: Heart, text: "حمایت از ما", to: "/pricing" },
      { Icon: Megaphone, text: "تبلیغات", to: "/support" },
      { Icon: UserRound, text: "پروفایل من", to: "/profile" },
    ],
  },
];

export default function MainFooter() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    // TODO: اتصال به API خبرنامه
    setSubmitted(true);
    setEmail("");

    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <footer
      dir="rtl"
      className="relative mt-0 overflow-x-hidden border-t border-white/[0.08] bg-[#0a0510]/70 text-zinc-300"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-rose-400/70 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -top-24 right-[12%] h-48 w-48 rounded-full bg-rose-600/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 left-[8%] h-48 w-48 rounded-full bg-fuchsia-600/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-14">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* ==================== برند ==================== */}
          <div className="lg:col-span-4">
            <Link
              to="/"
              className="inline-flex w-full flex-wrap items-center justify-center gap-2 sm:justify-start"
            >
              <img
                src="/Logo-red.svg"
                alt="لوگو"
                className="h-14 w-auto shrink-0 sm:h-16"
              />

              <span className="text-3xl font-black text-white sm:text-4xl">
                مووی<span className="text-gradient">ورس</span>
              </span>
            </Link>

            <p className="mt-4 max-w-full text-center text-sm leading-7 text-zinc-400 sm:max-w-sm sm:text-right">
              بزرگ‌ترین مرجع دانلود و تماشای آنلاین فیلم و سریال با کیفیت
              بالا. هر روز با جدیدترین‌ها همراهت هستیم.
            </p>

            {/* ==================== خبرنامه ==================== */}
            <form onSubmit={handleSubscribe} className="mt-6">
              <label className="mb-2 block text-center text-sm font-medium text-zinc-200 sm:text-right">
                عضویت در خبرنامه
              </label>

              <div className="input-shell flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ایمیل خود را وارد کنید"
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                />

                <button
                  type="submit"
                  className="btn-brand w-full rounded-xl px-4 py-2 text-sm sm:w-auto"
                >
                  <Send size={16} />
                  <span>عضویت</span>
                </button>
              </div>

              {submitted && (
                <p className="mt-2 text-center text-xs text-emerald-400 sm:text-right">
                  عضویت شما با موفقیت ثبت شد ✓
                </p>
              )}
            </form>

            {/* ==================== شبکه‌های اجتماعی ==================== */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              {socials.map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition-all hover:scale-110 hover:border-rose-500/50 hover:bg-rose-600/20 hover:text-white"
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>

          {/* ==================== لینک‌ها ==================== */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8">
            {columns.map((col) => (
              <div key={col.title}>
                <h3 className="mb-4 flex items-center gap-2 text-sm font-black text-white">
                  <span className="h-4 w-1 rounded-full bg-brand-gradient" />
                  {col.title}
                </h3>

                <ul className="space-y-3">
                  {col.links.map(({ Icon, text, to }) => (
                    <li key={text}>
                      <Link
                        to={to}
                        className="group flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-rose-400"
                      >
                        <Icon
                          size={16}
                          className="shrink-0 text-zinc-500 transition-colors group-hover:text-rose-400"
                        />

                        <span className="break-words">{text}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ==================== پایین فوتر ==================== */}
      <div className="relative border-t border-white/[0.08] bg-black/25">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-5 text-center text-xs text-zinc-500 sm:flex-row sm:px-6 sm:text-right">
          <p>
            © {new Date().getFullYear()} مووی ورس — تمامی حقوق محفوظ است.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/support"
              className="transition hover:text-zinc-300"
            >
              پشتیبانی
            </Link>

            <span className="hidden h-1 w-1 rounded-full bg-zinc-600 sm:block" />

            <Link
              to="/faq"
              className="transition hover:text-zinc-300"
            >
              سوالات متداول
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}