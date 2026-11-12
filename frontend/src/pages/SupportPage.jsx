import { useState } from "react";
import {
  AlertTriangle,
  Bug,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  Clock3,
  Film,
  HeartHandshake,
  HelpCircle,
  Layers,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import SideImage from "../components/ui/SideImages";
import { useSeo } from "../seo/useSeo";
import api from "../services/api";

const BRAND = "bg-[linear-gradient(135deg,#fb7185,#e11d48_48%,#9333ea)]";

const faqItems = [
  {
    question: "اگر لینک دانلود خراب باشد چه کار کنم؟",
    answer:
      "از تب «گزارش لینک خراب» در فرم همین صفحه استفاده کنید و نام فیلم/سریال و کیفیت را بنویسید؛ گزارش شما مستقیم برای تیم پشتیبانی ارسال و در سریع‌ترین زمان بررسی می‌شود.",
  },
  {
    question: "چرا دانلود برای من شروع نمی‌شود؟",
    answer:
      "گاهی مشکل از مرورگر، اینترنت یا محدودیت موقتی سرور دانلود است. ابتدا صفحه را یک بار تازه‌سازی کنید، با مرورگر دیگری امتحان کنید و اگر مشکل ادامه داشت از فرم پشتیبانی پیام بفرستید.",
  },
  {
    question: "چطور می‌توانم فیلم یا سریال جدید درخواست بدهم؟",
    answer:
      "در تب «درخواست فیلم یا سریال» نام اثر، سال انتشار و نوع آن را ثبت کنید. درخواست‌ها بررسی می‌شوند و در صورت امکان به آرشیو اضافه خواهند شد.",
  },
  {
    question: "چرا زیرنویس یا دوبله با نسخه دانلودی هماهنگ نیست؟",
    answer:
      "گاهی نسخه‌های مختلف یک اثر زمان‌بندی متفاوتی دارند. اگر زیرنویس یا دوبله هماهنگ نبود، نام اثر و نسخه موردنظر را از طریق فرم پشتیبانی ارسال کنید تا بررسی شود.",
  },
  {
    question: "آیا پاسخ پیام‌های پشتیبانی ارسال می‌شود؟",
    answer:
      "بله. اگر ایمیل معتبر وارد کرده باشید، در صورت نیاز پاسخ یا نتیجه بررسی برای شما ارسال می‌شود. پیام‌ها هم در سیستم ذخیره می‌شوند و هم (در صورت فعال بودن) لحظه‌ای برای پشتیبانی ارسال می‌شوند.",
  },
];

const inputCls =
  "w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 transition focus:border-rose-400/50 focus:bg-white/[0.08] focus:ring-2 focus:ring-rose-500/20";

function Field({ label, icon: Icon, children, optional }) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-1.5 text-sm text-white/75">
        {Icon && <Icon className="h-3.5 w-3.5 text-rose-300/80" />}
        {label}
        {optional && <span className="text-[11px] text-white/35">(اختیاری)</span>}
      </label>
      {children}
    </div>
  );
}

function FAQItem({ item, isOpen, onToggle }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border backdrop-blur-xl transition ${
        isOpen ? "border-rose-400/30 bg-white/[0.07]" : "border-white/10 bg-white/[0.04] hover:border-white/20"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-right sm:px-5"
      >
        <span className="text-sm font-medium text-white sm:text-base">{item.question}</span>
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition ${
            isOpen ? `${BRAND} text-white` : "bg-white/10 text-white/70"
          }`}
        >
          <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
        </span>
      </button>
      <div className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="border-t border-white/10 px-4 py-4 text-sm leading-7 text-white/75 sm:px-5">
            {item.answer}
          </div>
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { id: "general", label: "پیام به پشتیبانی", icon: MessageCircle },
  { id: "report", label: "گزارش لینک خراب", icon: Bug },
  { id: "request", label: "درخواست فیلم / سریال", icon: Clapperboard },
];

const TYPE_OPTIONS = [
  { value: "movie", label: "فیلم" },
  { value: "series", label: "سریال" },
  { value: "animation", label: "انیمیشن" },
  { value: "anime", label: "انیمه" },
  { value: "documentary", label: "مستند" },
];

export default function SupportPage() {
  useSeo({
    title: "پشتیبانی و سوالات متداول | مووی‌ورس",
    description:
      "پاسخ سوالات متداول دانلود و تماشای آنلاین، گزارش خرابی لینک و درخواست فیلم و سریال جدید در پشتیبانی مووی‌ورس.",
    path: "/support",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqItems.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    },
  });

  const [openIndex, setOpenIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("general");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [honeypot, setHoneypot] = useState("");

  const [general, setGeneral] = useState({ name: "", email: "", subject: "", message: "" });
  const [report, setReport] = useState({ name: "", email: "", mediaTitle: "", quality: "", issue: "" });
  const [requestForm, setRequestForm] = useState({ name: "", email: "", title: "", year: "", type: "movie", note: "" });

  const bind = (setter) => (e) => {
    const { name, value } = e.target;
    setter((prev) => ({ ...prev, [name]: value }));
  };

  const buildPayload = () => {
    if (activeTab === "report") {
      return {
        category: "report",
        name: report.name,
        email: report.email,
        subject: `گزارش لینک خراب: ${report.mediaTitle}`,
        message: report.issue,
        meta: { "نام اثر": report.mediaTitle, "کیفیت / نسخه": report.quality },
        website: honeypot,
      };
    }
    if (activeTab === "request") {
      const typeLabel = TYPE_OPTIONS.find((t) => t.value === requestForm.type)?.label || "فیلم";
      const composed = `درخواست ${typeLabel}: ${requestForm.title}${requestForm.year ? ` (${requestForm.year})` : ""}`;
      return {
        category: "request",
        name: requestForm.name,
        email: requestForm.email,
        subject: composed,
        message: requestForm.note.trim().length >= 5 ? requestForm.note : composed,
        meta: { "نام اثر": requestForm.title, "سال انتشار": requestForm.year, "نوع محتوا": typeLabel },
        website: honeypot,
      };
    }
    return { category: "general", ...general, meta: {}, website: honeypot };
  };

  const validate = () => {
    if (activeTab === "general") {
      if (!general.name.trim()) return "نام خود را وارد کنید.";
      if (!general.message.trim() || general.message.trim().length < 5) return "متن پیام را کامل بنویسید.";
    }
    if (activeTab === "report") {
      if (!report.mediaTitle.trim()) return "نام فیلم یا سریال را وارد کنید.";
      if (!report.issue.trim() || report.issue.trim().length < 5) return "توضیح مشکل را بنویسید.";
    }
    if (activeTab === "request") {
      if (!requestForm.title.trim()) return "نام فیلم یا سریال درخواستی را وارد کنید.";
    }
    const email = activeTab === "general" ? general.email : activeTab === "report" ? report.email : requestForm.email;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "ایمیل واردشده معتبر نیست.";
    return "";
  };

  const submit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setSending(true);
    try {
      await api.post("/support/messages/", buildPayload());
      setSent(true);
      setGeneral({ name: "", email: "", subject: "", message: "" });
      setReport({ name: "", email: "", mediaTitle: "", quality: "", issue: "" });
      setRequestForm({ name: "", email: "", title: "", year: "", type: "movie", note: "" });
      setHoneypot("");
    } catch (err) {
      if (err?.response?.status === 429) {
        setError("به سقف ارسال پیام در این ساعت رسیدید؛ لطفاً چند دقیقه دیگر دوباره تلاش کنید.");
      } else {
        const data = err?.response?.data;
        const first = data && typeof data === "object" ? Object.values(data).flat?.()[0] : null;
        setError(first ? String(first) : "ارسال پیام ناموفق بود. لطفاً دوباره تلاش کنید یا از تلگرام/ایمیل استفاده کنید.");
      }
    } finally {
      setSending(false);
    }
  };

  const contactRow = (values, onChange) => (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="نام شما" icon={User} optional>
        <input name="name" value={values.name} onChange={onChange} placeholder="مثلاً جواد احمدی" className={inputCls} />
      </Field>
      <Field label="ایمیل (برای پاسخ)" icon={Mail} optional>
        <input type="email" name="email" value={values.email} onChange={onChange} placeholder="example@email.com" dir="ltr" className={`${inputCls} text-left`} />
      </Field>
    </div>
  );

  return (
    <div dir="rtl" className="relative min-h-screen overflow-hidden bg-[#08040d] px-4 py-6 sm:px-6 sm:py-8 md:px-8">
      <SideImage showOther={false} showMinions={false} />

      {/* هاله‌های نوری پس‌زمینه */}
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-fuchsia-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 top-64 h-96 w-96 rounded-full bg-rose-600/[0.14] blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-1/3 h-72 w-72 rounded-full bg-purple-700/10 blur-3xl" />

      <div className="relative mx-auto mt-20 max-w-7xl sm:mt-24 md:mt-28">
        {/* ===== Hero ===== */}
        <section className="relative mb-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl sm:mb-10 sm:p-10">
          <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 ${BRAND}`} />
          <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-rose-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-10 h-56 w-56 rounded-full bg-purple-600/15 blur-3xl" />

          <div className="relative mx-auto max-w-3xl text-center">
            <div className={`mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl ${BRAND} text-white shadow-[0_18px_50px_rgba(225,29,72,0.35)]`}>
              <HeartHandshake className="h-8 w-8" />
            </div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-medium text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              پشتیبانی آنلاین و آماده‌ی پاسخ‌گویی
            </div>
            <h1 className="text-3xl font-black leading-tight text-white sm:text-5xl">
              حمایت و پشتیبانی{" "}
              <span className={`${BRAND} bg-clip-text text-transparent`}>مووی‌ورس</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-white/70 sm:text-base">
              لینک خراب دیدی؟ دانلود شروع نمی‌شود؟ یا فیلمی را پیدا نمی‌کنی؟
              از همین صفحه پیام بده؛ پیامت هم در سیستم ثبت می‌شود و هم مستقیم به دست تیم پشتیبانی می‌رسد.
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm">
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-2.5 text-white/80">
                <Zap className="h-4 w-4 text-amber-300" /> پاسخ در سریع‌ترین زمان ممکن
              </span>
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-2.5 text-white/80">
                <ShieldCheck className="h-4 w-4 text-emerald-300" /> بدون نیاز به ثبت‌نام
              </span>
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-2.5 text-white/80">
                <Clock3 className="h-4 w-4 text-sky-300" /> ثبت پیام در همه‌ی ساعت‌های روز
              </span>
            </div>
          </div>
        </section>

        {/* ===== راه‌های تماس سریع ===== */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2">
          <a
            href="https://t.me/javidslr"
            target="_blank"
            rel="noreferrer"
            className="group relative overflow-hidden rounded-3xl border border-sky-400/20 bg-gradient-to-br from-sky-500/15 via-white/[0.03] to-transparent p-5 transition duration-300 hover:-translate-y-0.5 hover:border-sky-300/40 hover:shadow-[0_20px_50px_rgba(14,165,233,0.15)]"
          >
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-sky-500/20 text-sky-300 ring-1 ring-sky-400/30 transition group-hover:scale-105">
                <Send className="h-6 w-6 rotate-[-18deg]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white">تلگرام</h3>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-400/25">سریع‌ترین</span>
                </div>
                <p className="mt-0.5 text-xs text-white/50">هر روز از ۱۰ صبح تا ۱۲ شب</p>
                <p dir="ltr" className="mt-1.5 truncate text-left font-semibold tracking-wide text-sky-300">@JavidSlr</p>
              </div>
              <Sparkles className="ms-auto h-5 w-5 shrink-0 text-sky-300/40 transition group-hover:text-sky-300" />
            </div>
          </a>

          <a
            href="mailto:jmovieverse@gmail.com"
            className="group relative overflow-hidden rounded-3xl border border-rose-400/20 bg-gradient-to-br from-rose-500/15 via-white/[0.03] to-transparent p-5 transition duration-300 hover:-translate-y-0.5 hover:border-rose-300/40 hover:shadow-[0_20px_50px_rgba(225,29,72,0.15)]"
          >
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-rose-500/20 text-rose-300 ring-1 ring-rose-400/30 transition group-hover:scale-105">
                <Mail className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-white">ایمیل</h3>
                <p className="mt-0.5 text-xs text-white/50">مناسب برای توضیحات کامل و پیگیری رسمی</p>
                <p className="mt-1.5 truncate font-semibold text-rose-300">JMovieVerse@gmail.com</p>
              </div>
              <Sparkles className="ms-auto h-5 w-5 shrink-0 text-rose-300/40 transition group-hover:text-rose-300" />
            </div>
          </a>
        </section>

        {/* ===== فرم‌ها + نکات ===== */}
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl sm:p-6 lg:col-span-2">
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 ${BRAND} opacity-70`} />

            {/* تب‌ها */}
            <div className="mb-6 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/30 p-1.5">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => { setActiveTab(tab.id); setSent(false); setError(""); }}
                  className={`flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-xs font-bold transition sm:text-sm ${
                    activeTab === tab.id ? `${BRAND} text-white shadow-[0_10px_30px_rgba(225,29,72,0.3)]` : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <tab.icon className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                </button>
              ))}
            </div>

            {sent ? (
              <div className="flex flex-col items-center rounded-3xl border border-emerald-400/25 bg-emerald-500/[0.08] px-6 py-12 text-center">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
                  <CheckCircle2 className="h-8 w-8" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-white">پیام شما با موفقیت ثبت شد</h3>
                <p className="mt-2 max-w-md text-sm leading-7 text-white/65">
                  ممنون از همراهی‌تان! پیام شما برای تیم پشتیبانی ارسال شد و در سریع‌ترین زمان بررسی می‌شود.
                  اگر ایمیل وارد کرده باشید، پاسخ را همان‌جا دریافت می‌کنید.
                </p>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className={`mt-6 rounded-2xl ${BRAND} px-6 py-3 text-sm font-bold text-white transition hover:opacity-90`}
                >
                  ارسال پیام دیگر
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {/* تله‌ی اسپم: برای کاربر واقعی پنهان است */}
                <input
                  type="text"
                  name="website"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  className="hidden"
                  aria-hidden="true"
                />

                {activeTab === "general" && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="نام و نام خانوادگی" icon={User}>
                        <input name="name" value={general.name} onChange={bind(setGeneral)} placeholder="مثلاً جواد احمدی" className={inputCls} />
                      </Field>
                      <Field label="ایمیل" icon={Mail}>
                        <input type="email" name="email" value={general.email} onChange={bind(setGeneral)} placeholder="example@email.com" dir="ltr" className={`${inputCls} text-left`} />
                      </Field>
                    </div>
                    <Field label="موضوع" icon={MessageCircle} optional>
                      <input name="subject" value={general.subject} onChange={bind(setGeneral)} placeholder="مثلاً مشکل در دانلود، سؤال درباره اشتراک و..." className={inputCls} />
                    </Field>
                    <Field label="متن پیام" icon={Send}>
                      <textarea name="message" value={general.message} onChange={bind(setGeneral)} rows={6} placeholder="مشکل یا درخواست خود را با جزئیات بنویسید..." className={`${inputCls} resize-none leading-7`} />
                    </Field>
                  </>
                )}

                {activeTab === "report" && (
                  <>
                    {contactRow(report, bind(setReport))}
                    <Field label="نام فیلم / سریال" icon={Film}>
                      <input name="mediaTitle" value={report.mediaTitle} onChange={bind(setReport)} placeholder="مثلاً Inception یا Breaking Bad" className={inputCls} />
                    </Field>
                    <Field label="کیفیت / نسخه" icon={Layers} optional>
                      <input name="quality" value={report.quality} onChange={bind(setReport)} placeholder="مثلاً 1080p BluRay x265 — اگر قسمت است: فصل و قسمت را هم بنویسید" className={inputCls} />
                    </Field>
                    <Field label="توضیح مشکل" icon={AlertTriangle}>
                      <textarea name="issue" value={report.issue} onChange={bind(setReport)} rows={5} placeholder="مثلاً لینک باز نمی‌شود، فایل ناقص است، صدا ندارد، زیرنویس هماهنگ نیست و..." className={`${inputCls} resize-none leading-7`} />
                    </Field>
                  </>
                )}

                {activeTab === "request" && (
                  <>
                    {contactRow(requestForm, bind(setRequestForm))}
                    <Field label="نام فیلم / سریال درخواستی" icon={Film}>
                      <input name="title" value={requestForm.title} onChange={bind(setRequestForm)} placeholder="نام فارسی یا انگلیسی اثر" className={inputCls} />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="سال انتشار" icon={Calendar} optional>
                        <input name="year" value={requestForm.year} onChange={bind(setRequestForm)} placeholder="مثلاً 2023" inputMode="numeric" className={inputCls} />
                      </Field>
                      <Field label="نوع محتوا" icon={Layers}>
                        <select name="type" value={requestForm.type} onChange={bind(setRequestForm)} className={`${inputCls} bg-[#17101f]`}>
                          {TYPE_OPTIONS.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <Field label="توضیحات تکمیلی" icon={MessageCircle} optional>
                      <textarea name="note" value={requestForm.note} onChange={bind(setRequestForm)} rows={4} placeholder="اگر نسخه، کیفیت، دوبله یا زیرنویس خاصی مدنظر دارید اینجا بنویسید..." className={`${inputCls} resize-none leading-7`} />
                    </Field>
                  </>
                )}

                {error && (
                  <div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl ${BRAND} px-5 py-3.5 text-sm font-bold text-white shadow-[0_16px_40px_rgba(225,29,72,0.3)] transition hover:opacity-90 hover:shadow-[0_16px_50px_rgba(225,29,72,0.45)] active:scale-[0.99] disabled:cursor-wait disabled:opacity-60`}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {sending
                    ? "در حال ارسال..."
                    : activeTab === "report"
                      ? "ثبت گزارش"
                      : activeTab === "request"
                        ? "ثبت درخواست"
                        : "ارسال پیام"}
                </button>
                <p className="text-center text-[11px] leading-5 text-white/40">
                  با ارسال این فرم، پیام شما در سیستم ذخیره و برای تیم پشتیبانی ارسال می‌شود.
                </p>
              </form>
            )}
          </div>

          {/* ستون کناری: اولویت‌ها و نکات */}
          <aside className="space-y-4">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400 shadow-[0_0_14px_rgba(251,113,133,0.9)]" />
                اولویت بررسی پیام‌ها
              </h3>
              <ul className="space-y-2 text-sm text-white/70">
                {["گزارش لینک خراب", "مشکل دانلود و پخش", "درخواست فیلم / سریال", "مشکلات حساب کاربری", "سایر سؤال‌ها"].map((t, i) => (
                  <li key={t} className="flex items-center gap-2.5 rounded-2xl bg-white/[0.03] px-3.5 py-2.5">
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white ${BRAND}`}>{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[2rem] border border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-white/[0.03] to-transparent p-5 backdrop-blur-xl">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.9)]" />
                برای پاسخ سریع‌تر
              </h3>
              <div className="space-y-2 text-sm leading-7 text-white/70">
                <p className="rounded-2xl bg-black/25 px-3.5 py-2.5">برای هر مشکل فقط <b className="text-white">یک پیام</b> بفرستید؛ ارسال تکراری بررسی را کندتر می‌کند.</p>
                <p className="rounded-2xl bg-black/25 px-3.5 py-2.5">نام اثر، <b className="text-white">فصل و قسمت</b> و کیفیت را دقیق بنویسید.</p>
                <p className="rounded-2xl bg-black/25 px-3.5 py-2.5">متن خطا یا توضیح دقیق مشکل، نصف راه حل است.</p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                <HelpCircle className="h-4 w-4 text-rose-300" />
                عجله دارید؟
              </h3>
              <p className="text-sm leading-7 text-white/65">
                برای مشکل‌های فوری، تلگرام سریع‌ترین راه است؛ معمولاً در ساعت‌های پاسخ‌گویی زودتر جواب می‌گیرید.
              </p>
              <a
                href="https://t.me/javidslr"
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-sky-500/15 px-4 py-3 text-sm font-bold text-sky-300 ring-1 ring-sky-400/25 transition hover:bg-sky-500/25"
              >
                <Send className="h-4 w-4 rotate-[-18deg]" /> پیام در تلگرام
              </a>
            </div>
          </aside>
        </section>

        {/* ===== FAQ ===== */}
        <section className="mt-10">
          <div className="mb-5 flex items-center gap-3">
            <div className={`grid h-11 w-11 place-items-center rounded-2xl ${BRAND} text-white shadow-[0_12px_30px_rgba(225,29,72,0.3)]`}>
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white sm:text-xl">سوالات متداول</h2>
              <p className="mt-0.5 text-sm text-white/55">شاید پاسخ سؤالتان همین‌جا باشد و نیازی به ارسال پیام نباشد.</p>
            </div>
          </div>
          <div className="space-y-3">
            {faqItems.map((item, index) => (
              <FAQItem
                key={item.question}
                item={item}
                isOpen={openIndex === index}
                onToggle={() => setOpenIndex((prev) => (prev === index ? -1 : index))}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
