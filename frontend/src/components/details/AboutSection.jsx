import { useState } from "react";

export default function AboutSection({ title = "", description = "" }) {
  const [expanded, setExpanded] = useState(false);

  if (!description) return null;

  const isLong = description.length > 300;
  const text = expanded || !isLong ? description : `${description.slice(0, 300)}…`;

  return (
    <section dir="rtl" className="px-8 py-14 sm:px-14 lg:px-20">
      <div className="mx-auto max-w-5xl">
        {/* خط تزئینی هماهنگ با هیرو */}
        <div className="mb-5 h-1 w-12 rounded-full bg-gradient-to-l
          from-rose-500 to-[#9333ea] shadow-[0_0_12px_[#9333ea]]" />

        <h2 className="mb-6 bg-gradient-to-l from-white to-white/40
          bg-clip-text text-3xl font-black tracking-tight
          text-transparent sm:text-4xl">
          درباره {title}
        </h2>

        <p className="max-w-4xl text-base leading-loose text-white/70 sm:text-lg">
          {text}
        </p>

        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-5 text-sm font-semibold text-sky-400
              transition hover:text-sky-300"
          >
            {expanded ? "نمایش کمتر" : "بیشتر بخوانید"}
          </button>
        )}
      </div>
    </section>
  );
}
