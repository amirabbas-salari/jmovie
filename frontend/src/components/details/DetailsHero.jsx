import { useState } from "react";
import { Link } from "react-router-dom";
import { FiBookmark, FiThumbsUp, FiThumbsDown, FiPlay, FiEye } from "react-icons/fi";
import { backdropImage, backdropSrcSet } from "../../utils/image";

const IconButton = ({ active, onClick, label, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    aria-pressed={active}
    className={`group relative grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-full
      border backdrop-blur-md text-white/80 transition-all duration-300
      hover:scale-110 active:scale-95
      ${active
        ? "border-white bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]"
        : "border-white/20 bg-white/10 hover:bg-white/20 hover:text-white hover:border-white/40"
      }`}
  >
    <span className="text-base sm:text-lg transition-transform duration-300 group-hover:scale-110">
      {children}
    </span>
  </button>
);

const Badge = ({ children }) => (
  <span className="rounded-full border border-white/20 bg-white/[0.08]
    px-3 py-1 text-[11px] sm:text-xs font-medium backdrop-blur-md text-white/90 tracking-wide">
    {children}
  </span>
);

export default function DetailsHero({ media }) {
  const [bookmarked, setBookmarked] = useState(false);
  const [reaction, setReaction] = useState(null);

  return (
    <section
      dir="ltr"
      className="relative h-[80vh] min-h-[440px] sm:h-[72vh] sm:min-h-[500px] w-full overflow-hidden text-white select-none"
    >
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src={backdropImage(media.backdrop_url)}
          srcSet={backdropSrcSet(media.backdrop_url)}
          sizes="100vw"
          alt={media.original_title}
          className="h-full w-full object-cover motion-safe:lg:animate-ken-burns"
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />

      </div>

      {/* Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/10 to-transparent" />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_-80px_120px_[#1A0B0C]]" />

      {/* Content */}
      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col
        justify-end gap-5 px-5 pb-20 sm:gap-7 sm:px-14 sm:pb-32 lg:px-20
        animate-[fadeUp_0.7s_ease-out]">

        {/* عنوان + متادیتا */}
        <div className="max-w-xl space-y-3 sm:space-y-4">
          <div className="h-1 w-10 sm:w-12 rounded-full bg-gradient-to-r from-rose-500 to-[#751a6c]
            shadow-[0_0_12px_[#1A0B0C]]" />

          <h1 className="text-2xl font-black leading-tight tracking-tight
            drop-shadow-2xl sm:text-5xl lg:text-6xl">
            {media.original_title} {media.year}
          </h1>

          {(media.year || media.duration || media.imdb_rating || media.genres.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-sm">
              {media.imdb_rating && (
                <span className="flex items-center gap-1.5 rounded-full
                  bg-gradient-to-r from-amber-400 to-yellow-500
                  px-3 py-1 text-xs sm:text-sm font-bold text-black
                  shadow-[0_0_15px_rgba(251,191,36,0.5)]">
                  ★ {media.imdb_rating}
                </span>
              )}
              {/* {media.year && <Badge>{media.year}</Badge>} */}
              <div dir="rtl">
                {media.duration && <Badge>{media.duration}</Badge>}
              </div>
              {media.country && <Badge>{media.country}</Badge>}
              {media.genres.slice(0, 3).map((g) => {
                const id = typeof g === "object" ? (g.id ?? g.slug ?? g.name) : g;
                const name = typeof g === "object" ? g.name : g;
                const slug = typeof g === "object" ? g.slug : g;

                return (
                  <Link
                    key={id}
                    to={`/genre/${slug}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-block"
                  >
                    <Badge>{name}</Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* دکمه‌ها */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {/* اکشن‌های ثانویه */}
          <div className="order-2 flex items-center gap-2.5 sm:order-1">
            <IconButton label="Bookmark" active={bookmarked} onClick={() => setBookmarked((v) => !v)}>
              <FiBookmark className={bookmarked ? "fill-current" : ""} />
            </IconButton>
            <IconButton label="Like" active={reaction === "like"} onClick={() => setReaction((r) => (r === "like" ? null : "like"))}>
              <FiThumbsUp />
            </IconButton>
            <IconButton label="Dislike" active={reaction === "dislike"} onClick={() => setReaction((r) => (r === "dislike" ? null : "dislike"))}>
              <FiThumbsDown />
            </IconButton>
          </div>

          {/* اکشن‌های اصلی */}
          <div className="order-1 flex items-center gap-2.5 sm:order-2 sm:ms-auto sm:gap-3">
            <button
              type="button"
              className="group relative flex flex-1 sm:flex-none items-center justify-center gap-2 overflow-hidden
                rounded-2xl bg-gradient-to-r from-rose-500 to-[#751a6c]
                px-5 py-3 sm:px-7 sm:py-3.5 text-sm sm:text-base font-bold text-white
                shadow-[0_0_30px_[#1A0B0C]]
                transition-all duration-300
                hover:shadow-[0_0_50px_[]#1A0B0C]
                hover:scale-[1.03] active:scale-95"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r
                from-transparent via-white/25 to-transparent
                transition-transform duration-700 group-hover:translate-x-full" />
              <FiPlay className="fill-current text-base sm:text-lg" />
              پخش آنلاین
            </button>

            <button
              type="button"
              className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-2xl
                border border-white/20 bg-white/[0.08] px-5 py-3 sm:px-7 sm:py-3.5
                text-sm sm:text-base font-semibold text-white backdrop-blur-xl
                transition-all duration-300
                hover:bg-white/[0.16] hover:border-white/35
                active:scale-95"
            >
              <FiEye className="text-base sm:text-lg" />
              پیش نمایش
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
