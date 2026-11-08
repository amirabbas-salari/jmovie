import { useRef } from "react";
import { FiChevronRight, FiChevronLeft } from "react-icons/fi";
import MediaCard from "./MediaCard";
import SectionHeader from "../ui/SectionHeader";

export default function MediaRow({ title, media = [], onSeeAll, type="media" }) {
  const scrollRef = useRef(null);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    // در RTL مقدار اسکرول منفی است؛ این فرمول هر دو جهت را پوشش می‌دهد
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === "next" ? -amount : amount, behavior: "smooth" });
  };

  if (!media.length) return null;

  return (
    <section dir="rtl" className="cv-auto relative w-full py-6 text-white">
      <SectionHeader
        title={title}
        eyebrow={type === "series" ? "سریال‌های منتخب" : type === "movie" ? "فیلم‌های منتخب" : "منتخب مووی‌ورس"}
        onSeeAll={onSeeAll}
      />

      
      {/* لیست + دکمه‌های ناوبری */}
      <div className="group/row relative">
        {/* دکمه راست (در RTL یعنی قبلی‌ها) */}
        <button
          type="button"
          onClick={() => scroll("prev")}
          aria-label="قبلی"
          className="absolute right-0 top-1/2 z-20 hidden h-full w-16
            -translate-y-1/2 items-center justify-center
            bg-gradient-to-l from-black/80 to-transparent
            opacity-0 transition-opacity duration-300
            group-hover/row:opacity-100 md:flex"
        >
          <span className="icon-btn h-11 w-11">
            <FiChevronRight className="text-2xl" />
          </span>
        </button>

        {/* دکمه چپ (بعدی‌ها) */}
        <button
          type="button"
          onClick={() => scroll("next")}
          aria-label="بعدی"
          className="absolute left-0 top-1/2 z-20 hidden h-full w-16
            -translate-y-1/2 items-center justify-center
            bg-gradient-to-r from-black/80 to-transparent
            opacity-0 transition-opacity duration-300
            group-hover/row:opacity-100 md:flex"
        >
          <span className="icon-btn h-11 w-11">
            <FiChevronLeft className="text-2xl" />
          </span>
        </button>

        {/* اسکرول افقی */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scroll-smooth px-4 pb-2
            sm:gap-4 sm:px-10 lg:px-16
            [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none]
            [scrollbar-width:none]"
        >
          {media.map((media) => (
            <MediaCard key={media.slug ?? media.id} media={media} type={type} />
          ))}
        </div>
      </div>
    </section>
  );
}
