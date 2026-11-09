import { useState } from "react";
import {
  Mail,
  Send,
  MessageCircle,
  HelpCircle,
  Bug,
  Film,
  ChevronDown,
  Phone,
  Clock3,
} from "lucide-react";
import SideImage from "../components/ui/SideImages";
import { useSeo } from "../seo/useSeo";

const faqItems = [
  {
    question: "اگر لینک دانلود خراب باشد چه کار کنم؟",
    answer:
      "اگر یکی از لینک‌های دانلود خراب بود، از بخش «گزارش مشکل» پایین همین صفحه استفاده کنید و نام فیلم/سریال، کیفیت و در صورت امکان نوع مشکل را برای ما بنویسید تا سریع‌تر بررسی شود.",
  },
  {
    question: "چرا دانلود برای من شروع نمی‌شود؟",
    answer:
      "گاهی مشکل از مرورگر، اینترنت یا محدودیت‌های موقتی سرور دانلود است. ابتدا یک بار صفحه را رفرش کنید، با مرورگر دیگری امتحان کنید و در صورت ادامه مشکل، از فرم پشتیبانی برای ما پیام بفرستید.",
  },
  {
    question: "چطور می‌توانم فیلم یا سریال جدید درخواست بدهم؟",
    answer:
      "در بخش «درخواست فیلم یا سریال» نام اثر، سال انتشار و در صورت امکان نام اصلی آن را برای ما ارسال کنید. درخواست شما بررسی می‌شود و در صورت امکان به آرشیو اضافه خواهد شد.",
  },
  {
    question: "چرا زیرنویس یا دوبله با نسخه دانلودی هماهنگ نیست؟",
    answer:
      "گاهی نسخه‌های مختلف یک اثر زمان‌بندی متفاوتی دارند. اگر زیرنویس یا دوبله هماهنگ نبود، از طریق فرم پشتیبانی نام اثر و نسخه موردنظر را ارسال کنید تا بررسی شود.",
  },
  {
    question: "آیا پاسخ پیام‌های پشتیبانی ارسال می‌شود؟",
    answer:
      "بله، پیام‌های ارسالی بررسی می‌شوند. اگر ایمیل معتبر وارد کرده باشید، در صورت نیاز پاسخ یا نتیجه بررسی برای شما ارسال خواهد شد.",
  },
];

function FAQItem({ item, isOpen, onToggle }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-right sm:px-5"
      >
        <span className="text-sm font-medium text-white sm:text-base">
          {item.question}
        </span>

        <ChevronDown
          className={`h-5 w-5 shrink-0 text-white/70 transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        className={`grid transition-all duration-300 ${
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-white/10 px-4 py-4 text-sm leading-7 text-white/75 sm:px-5">
            {item.answer}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-rose-300">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-bold text-white sm:text-base">{title}</h3>
      </div>

      <div className="text-sm leading-7 text-white/70">{children}</div>
    </div>
  );
}





function ContactCenter() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:col-span-3">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-sky-500/10 via-fuchsia-500/5 to-transparent p-4 sm:p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-fuchsia-500/10 blur-3xl" />

        <div className="relative z-10">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs tracking-wide text-white/45">
                مرکز ارتباط با پشتیبانی
              </p>
              <h3 className="mt-1 text-lg font-bold text-white sm:text-xl">
                تماس با ما
              </h3>
            </div>

            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
              در دسترس
            </div>
          </div>

          <p className="max-w-2xl text-sm leading-7 text-white/65">
            برای گزارش لینک خراب، مشکل دانلود، هماهنگ نبودن زیرنویس، مشکل پخش،
            مشکلات حساب کاربری یا درخواست فیلم و سریال می‌تونی از راه‌های زیر با
            پشتیبانی در ارتباط باشی.
          </p>
        </div>
      </div>

      {/* Contact Methods */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* Telegram */}
        <a
          href="https://t.me/javidslr"
          target="_blank"
          rel="noreferrer"
          className="group rounded-3xl border border-sky-400/20 bg-gradient-to-br from-sky-500/10 via-transparent to-transparent p-4 transition hover:border-sky-300/30 hover:bg-sky-500/10"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/20">
              <Send className="h-5 w-5 rotate-[-18deg]" />
            </div>

            <div>
              <div className="text-sm font-semibold text-white">تلگرام</div>
              <div className="text-xs text-white/45">
                سریع‌ترین راه ارتباطی
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm">
            <div className="text-xs text-white/45">آیدی پشتیبانی</div>
            <div dir="ltr" className="text-right mt-1 font-semibold tracking-wide text-sky-300">
              @JavidSlr
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
            <div className="text-xs text-white/45">زمان پاسخ‌گویی</div>
            <div className="mt-1 text-sm text-white">
              هر روز از ۱۰ صبح تا ۱۲ شب
            </div>
          </div>
        </a>

        {/* Email */}
        <a
          href="mailto:jmovieverse@gmail.com"
          className="group rounded-3xl border border-rose-400/20 bg-gradient-to-br from-rose-500/10 via-transparent to-transparent p-4 transition hover:border-rose-300/30 hover:bg-rose-500/10"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/20">
              <Mail className="h-5 w-5" />
            </div>

            <div>
              <div className="text-sm font-semibold text-white">ایمیل</div>
              <div className="text-xs text-white/45">
                مناسب برای توضیحات کامل‌تر
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm break-all">
            <div className="text-xs text-white/45">ایمیل پشتیبانی</div>
            <div className="mt-1 font-semibold text-rose-300">
              JMovieVerse@gmail.com
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
            <div className="text-xs text-white/45">زمان پاسخ‌گویی</div>
            <div className="mt-1 text-sm text-white">
              پاسخ‌گویی در سریع‌ترین زمان ممکن
            </div>
          </div>
        </a>
      </div>

      {/* Quick Status */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.9)]" />
            <h4 className="text-sm font-semibold text-white">
              وضعیت پاسخ‌گویی
            </h4>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-white/65">تلگرام</span>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                  فعال
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-white/65">ایمیل</span>
                <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-300">
                  در حال بررسی
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-rose-400 shadow-[0_0_16px_rgba(251,113,133,0.9)]" />
            <h4 className="text-sm font-semibold text-white">اولویت پیام‌ها</h4>
          </div>

          <ul className="space-y-2 text-sm text-white/70">
            <li className="rounded-2xl bg-white/[0.03] px-3 py-2.5">
              گزارش لینک خراب
            </li>
            <li className="rounded-2xl bg-white/[0.03] px-3 py-2.5">
              مشکل دانلود
            </li>
            <li className="rounded-2xl bg-white/[0.03] px-3 py-2.5">
              درخواست فیلم / سریال
            </li>
            <li className="rounded-2xl bg-white/[0.03] px-3 py-2.5">
              مشکلات حساب کاربری
            </li>
          </ul>
        </div>

        <div className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.9)]" />
            <h4 className="text-sm font-semibold text-white">نکات مهم</h4>
          </div>

          <div className="space-y-2 text-sm leading-7 text-white/70">
            <p className="rounded-2xl bg-black/20 px-3 py-2.5">
              برای هر مشکل فقط <span className="text-white">یک پیام</span> ارسال
              کنید.
            </p>
            <p className="rounded-2xl bg-black/20 px-3 py-2.5">
              نام فیلم/سریال، کیفیت و نوع مشکل را هم بنویس.
            </p>
            <p className="rounded-2xl bg-black/20 px-3 py-2.5">
              در صورت امکان اسکرین‌شات یا متن خطا را هم ارسال کن.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}











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

  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const [requestForm, setRequestForm] = useState({
    title: "",
    year: "",
    type: "movie",
    note: "",
  });

  const [reportForm, setReportForm] = useState({
    mediaTitle: "",
    quality: "",
    issue: "",
  });

  const updateForm = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const updateRequestForm = (e) => {
    const { name, value } = e.target;
    setRequestForm((prev) => ({ ...prev, [name]: value }));
  };

  const updateReportForm = (e) => {
    const { name, value } = e.target;
    setReportForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitSupport = (e) => {
    e.preventDefault();

    // اینجا بعداً می‌تونی درخواست API بزنی
    console.log("support form:", form);

    alert("پیام شما با موفقیت ثبت شد.");
    setForm({
      name: "",
      email: "",
      subject: "",
      message: "",
    });
  };

  const handleSubmitRequest = (e) => {
    e.preventDefault();

    console.log("request form:", requestForm);

    alert("درخواست شما ثبت شد.");
    setRequestForm({
      title: "",
      year: "",
      type: "movie",
      note: "",
    });
  };

  const handleSubmitReport = (e) => {
    e.preventDefault();

    console.log("report form:", reportForm);

    alert("گزارش شما ثبت شد.");
    setReportForm({
      mediaTitle: "",
      quality: "",
      issue: "",
    });
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-b from-black to-[#08040d] px-4 py-6 sm:px-6 sm:py-8 md:px-8"
    >
      <SideImage showOther={false} showMinions={false} />

      {/* هاله‌های نوری */}
      <div className="pointer-events-none fixed -right-20 -top-20 h-60 w-60 rounded-full bg-fuchsia-600/20 blur-3xl sm:-right-40 sm:-top-40 sm:h-96 sm:w-96" />
      <div className="pointer-events-none fixed -left-20 top-20 h-60 w-60 rounded-full bg-rose-600/[0.13] blur-3xl sm:-left-40 sm:top-40 sm:h-96 sm:w-96" />

      <div className="relative mx-auto mt-20 max-w-7xl sm:mt-24 md:mt-28">
        {/* Hero */}
        <section className="mb-8 rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:mb-10 sm:p-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-rose-500/30 to-fuchsia-500/20 text-rose-200 shadow-[0_0_40px_rgba(244,63,94,0.15)]">
              <HelpCircle className="h-7 w-7" />
            </div>

            <h1 className="text-2xl font-extrabold text-white sm:text-4xl">
              پشتیبانی
            </h1>

            <p className="mt-4 text-sm leading-7 text-white/70 sm:text-base sm:leading-8">
              اگر در دانلود، پخش، زیرنویس، دوبله یا پیدا کردن فیلم و سریال موردنظرت
              مشکلی داری، از همین صفحه با ما در ارتباط باش. تیم پشتیبانی در سریع‌ترین
              زمان ممکن درخواست‌ها و گزارش‌های شما را بررسی می‌کند.
            </p>
          </div>
        </section>

        {/* بخش بالا: اطلاعات تماس + فرم اصلی */}
        <section className="grid gap-6">

          <ContactCenter/>

          {/* فرم تماس */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl sm:p-6 lg:col-span-3">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-rose-300">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white sm:text-xl">
                  ارسال پیام به پشتیبانی
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  برای مشکلات عمومی، سوالات یا پیگیری درخواست‌ها از این فرم استفاده
                  کن.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitSupport} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-white/75">
                    نام و نام خانوادگی
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={updateForm}
                    placeholder="مثلاً جواد احمدی"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 transition focus:border-rose-400/40 focus:bg-white/10"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-white/75">
                    ایمیل
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={updateForm}
                    placeholder="example@email.com"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 transition focus:border-rose-400/40 focus:bg-white/10"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/75">موضوع</label>
                <input
                  type="text"
                  name="subject"
                  value={form.subject}
                  onChange={updateForm}
                  placeholder="مثلاً مشکل در دانلود، سوال درباره اشتراک، گزارش مشکل و ..."
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 transition focus:border-rose-400/40 focus:bg-white/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/75">
                  متن پیام
                </label>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={updateForm}
                  rows={6}
                  placeholder="مشکل یا درخواست خود را با جزئیات بنویس..."
                  className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-white/35 transition focus:border-rose-400/40 focus:bg-white/10"
                />
              </div>

              <button
                disabled
                type="submit"
                // className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-fuchsia-600 px-5 py-3 text-sm font-medium text-white shadow-[0_10px_30px_rgba(225,29,72,0.25)] transition hover:scale-[1.02] active:scale-[0.98]"
                className="
                    flex
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-zinc-800
                    px-4
                    py-3
                    text-sm
                    font-medium
                    text-zinc-500
                    cursor-not-allowed
                "
              >
                <Send className="h-4 w-4" />
                ارسال پیام - "موقتا غیرفعال"
              </button>
            </form>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-10">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-rose-300">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white sm:text-xl">
                سوالات متداول
              </h2>
              <p className="mt-1 text-sm text-white/60">
                شاید پاسخ سوالت همین‌جا باشد.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {faqItems.map((item, index) => (
              <FAQItem
                key={item.question}
                item={item}
                isOpen={openIndex === index}
                onToggle={() =>
                  setOpenIndex((prev) => (prev === index ? -1 : index))
                }
              />
            ))}
          </div>
        </section>

        {/* گزارش مشکل + درخواست فیلم */}
        <section className="mt-10 grid gap-6 xl:grid-cols-2">
          {/* گزارش لینک خراب */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl sm:p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-rose-300">
                <Bug className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white sm:text-xl">
                  گزارش لینک خراب یا مشکل دانلود
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  اگر لینک دانلود خراب است یا فایل مشکل دارد، این فرم را کامل کن.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-white/75">
                  نام فیلم / سریال
                </label>
                <input
                  type="text"
                  name="mediaTitle"
                  value={reportForm.mediaTitle}
                  onChange={updateReportForm}
                  placeholder="مثلاً Inception یا Breaking Bad"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 transition focus:border-rose-400/40 focus:bg-white/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/75">
                  کیفیت / نسخه
                </label>
                <input
                  type="text"
                  name="quality"
                  value={reportForm.quality}
                  onChange={updateReportForm}
                  placeholder="مثلاً 1080p BluRay x265"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 transition focus:border-rose-400/40 focus:bg-white/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/75">
                  توضیح مشکل
                </label>
                <textarea
                  name="issue"
                  value={reportForm.issue}
                  onChange={updateReportForm}
                  rows={5}
                  placeholder="مثلاً لینک باز نمی‌شود، فایل ناقص است، صدا ندارد، زیرنویس هماهنگ نیست و ..."
                  className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-white/35 transition focus:border-rose-400/40 focus:bg-white/10"
                />
              </div>

              <button
                disabled
                type="submit"
                // className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/15"
                className="
                    flex
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-zinc-800
                    px-4
                    py-3
                    text-sm
                    font-medium
                    text-zinc-500
                    cursor-not-allowed
                "
              >
                <Bug className="h-4 w-4" />
                ثبت گزارش - "موقتا غیرفعال"
              </button>
            </form>
          </div>

          {/* درخواست فیلم / سریال */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl sm:p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-rose-300">
                <Film className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white sm:text-xl">
                  درخواست فیلم یا سریال
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  اگر اثری در سایت موجود نیست، از این بخش برای ثبت درخواست استفاده کن.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-white/75">
                  نام فیلم / سریال
                </label>
                <input
                  type="text"
                  name="title"
                  value={requestForm.title}
                  onChange={updateRequestForm}
                  placeholder="نام فارسی یا انگلیسی اثر"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 transition focus:border-rose-400/40 focus:bg-white/10"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-white/75">
                    سال انتشار
                  </label>
                  <input
                    type="text"
                    name="year"
                    value={requestForm.year}
                    onChange={updateRequestForm}
                    placeholder="مثلاً 2023"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 transition focus:border-rose-400/40 focus:bg-white/10"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-white/75">
                    نوع محتوا
                  </label>
                  <select
                    name="type"
                    value={requestForm.type}
                    onChange={updateRequestForm}
                    className="w-full rounded-2xl border border-white/10 bg-[#1b1113] px-4 py-3 text-sm text-white outline-none transition focus:border-rose-400/40"
                  >
                    <option value="movie">فیلم</option>
                    <option value="series">سریال</option>
                    <option value="animation">انیمیشن</option>
                    <option value="anime">انیمه</option>
                    <option value="documentary">مستند</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/75">
                  توضیحات تکمیلی
                </label>
                <textarea
                  name="note"
                  value={requestForm.note}
                  onChange={updateRequestForm}
                  rows={5}
                  placeholder="اگر نسخه، کیفیت، دوبله، زیرنویس یا توضیح خاصی مدنظر داری اینجا بنویس..."
                  className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-white/35 transition focus:border-rose-400/40 focus:bg-white/10"
                />
              </div>

              <button
                disabled
                type="submit"
                // className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/15"
                className="
                    flex
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-zinc-800
                    px-4
                    py-3
                    text-sm
                    font-medium
                    text-zinc-500
                    cursor-not-allowed
                "
              >
                <Film className="h-4 w-4" />
                ثبت درخواست - "موقتا غیرفعال"
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}