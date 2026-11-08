import { useRef } from "react";
import { FiChevronRight, FiChevronLeft } from "react-icons/fi";
import MediaCard from "./MediaCard";

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
      {/* هدر */}
      <div className="mb-4 flex items-center justify-between px-4 sm:px-10 lg:px-16">
        <div className="flex items-center gap-3">
          <span className="h-6 w-1 rounded-full bg-gradient-to-b
            from-rose-500 to-[#751a6c] shadow-[0_0_10px_[#751a6c]]" />
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
        </div>

        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="flex items-center gap-1 text-sm text-white/60
              transition-colors hover:text-white"
          >
            مشاهده همه
            <FiChevronLeft className="text-base" />
          </button>
        )}
      </div>

      
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
          <span className="grid h-11 w-11 place-items-center rounded-full
            bg-white/10 backdrop-blur-md transition-all hover:scale-110
            hover:bg-white/20">
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
          <span className="grid h-11 w-11 place-items-center rounded-full
            bg-white/10 backdrop-blur-md transition-all hover:scale-110
            hover:bg-white/20">
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
