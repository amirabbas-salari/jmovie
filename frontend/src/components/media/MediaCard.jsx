import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiStar, FiPlus, FiCheck } from "react-icons/fi";
import { posterImage } from "../../utils/image";

/* ─────────────────────────────
   شکل برش پوستر (200×300)
───────────────────────────── */

const R = 18;
const NR = 26;

const NOTCH_PATH = [
  `M ${R} 0`,
  `L ${200 - NR} 0`,
  `A ${NR} ${NR} 0 0 1 200 ${NR}`,
  `L 200 ${300 - R}`,
  `A ${R} ${R} 0 0 1 ${200 - R} 300`,
  `L ${R} 300`,
  `A ${R} ${R} 0 0 1 0 ${300 - R}`,
  `L 0 ${R}`,
  `A ${R} ${R} 0 0 1 ${R} 0`,
  "Z",
].join(" ");

const MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 200 300'
        preserveAspectRatio='none'>
      <path d='${NOTCH_PATH}' fill='black'/>
   </svg>`
)}")`;

const maskStyle = {
  WebkitMaskImage: MASK,
  maskImage: MASK,
  WebkitMaskSize: "100% 100%",
  maskSize: "100% 100%",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
};

function MediaCard({
  media,
  type = "movie",
}) {
  const navigate = useNavigate();

  const [saved, setSaved] = useState(false);

  // برای موبایل
  const [mobileOpen, setMobileOpen] = useState(false);

  const go = () => {
    navigate(`/${type}/${media.slug}`);
  };

  const toggleMobileInfo = (e) => {
    // در موبایل اولین لمس فقط اطلاعات را باز می‌کند
    if (window.innerWidth < 768) {
      e.preventDefault();
      e.stopPropagation();

      setMobileOpen((prev) => !prev);
    }
  };

  const Badge = ({ children }) => (
    <span
      className="
        rounded-full
        border
        border-white/20
        bg-white/10
        px-2.5
        py-0.5
        text-[10px]
        font-medium
        text-white/90
        sm:sm:backdrop-blur-md
        sm:px-3.5
        sm:py-1
        sm:text-xs
      "
    >
      {children}
    </span>
  );

  const description =
    media.description?.trim() ||
    "خلاصه‌ای برای این اثر ثبت نشده است.";
  return (
    <article
      dir="rtl"
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          go();
        }
      }}
      tabIndex={0}
      role="button"
      className="
        group
        relative
        w-full
        max-w-[148px]
        shrink-0
        cursor-pointer
        text-right
        outline-none
        transition-transform
        duration-300
        hover:-translate-y-1
        focus-visible:-translate-y-1
        min-[420px]:max-w-[164px]
        sm:max-w-56
        md:min-w-40
        md:max-w-56
        lg:min-w-44
        lg:max-w-[230px]
        xl:min-w-[190px]
      "
    >
      {/* دکمه علاقه‌مندی */}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setSaved((s) => !s);
        }}
        aria-label={
          saved
            ? "حذف از لیست"
            : "افزودن به لیست"
        }
        className={`
          absolute
          right-1.5
          top-1.5
          z-30
          grid
          h-8
          w-8
          place-items-center
          rounded-full
          border
          text-white
          shadow-[0_4px_14px_rgba(0,0,0,0.55)]
          sm:backdrop-blur-md
          transition-all
          duration-300
          hover:scale-110
          hover:rotate-[360deg]
          active:scale-90
          sm:h-9
          sm:w-9
          ${
            saved
              ? "border-emerald-400/40 bg-emerald-600/30 text-emerald-300"
              : "border-white/30 bg-white/5 hover:bg-white/10"
          }
        `}
      >
        {saved ? (
          <FiCheck className="text-base sm:text-lg" />
        ) : (
          <FiPlus className="text-base sm:text-lg" />
        )}
      </button>

      {/* پوستر */}

      <div
        style={maskStyle}
        onClick={toggleMobileInfo}
        className="
          relative
          aspect-[2/3]
          overflow-hidden
          bg-zinc-900
          transition-[filter]
          duration-300
          group-hover:drop-shadow-[0_10px_30px_rgba(225,29,72,0.4)]
        "
      >
        <img
          src={posterImage(media.poster || media.poster_url)}
          srcSet={posterSrcSet(media.poster || media.poster_url)}
          sizes="(max-width: 640px) 148px, 230px"
          alt={media.original_title}
          loading="lazy"
          decoding="async"
          width={342}
          height={513}
          className="
            h-full
            w-full
            object-cover
            transition-transform
            duration-700
            ease-out
            group-hover:scale-110
          "
        />

        {/* گرادینت */}

        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />

        <div
          className={`
            absolute
            inset-0
            bg-gradient-to-b
            from-black/90
            via-black/40
            to-black/30
            transition-opacity
            duration-300

            ${
              mobileOpen
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100"
            }
          `}
        />

        {/* امتیاز */}

        {media.imdb_rating && (
          <span
            className="
              absolute
              bottom-2
              left-2
              z-20
              flex
              items-center
              gap-1
              rounded-full
              bg-black/55
              px-2
              py-0.5
              text-[10px]
              font-bold
              text-amber-400
              ring-1
              ring-white/10
              sm:backdrop-blur-md
              sm:text-xs
            "
          >
            <FiStar className="fill-current" />
            {media.imdb_rating}
          </span>
        )}

        {/* Overlay */}

        <div
          className={`
            absolute
            inset-x-0
            top-2
            z-20
            p-2
            pt-8
            sm:p-3
            transition-all
            duration-300
            sm:pt-12

            ${
              mobileOpen
                ? "translate-y-0 opacity-100"
                : "-translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
            }
          `}
        >
          <h2 className="mb-1.5 text-center text-[13px] font-bold leading-5 text-white sm:mb-2 sm:text-xl sm:leading-normal">
            {media.title}
          </h2>

          <p
            className="
              line-clamp-3
              text-[10px]
              leading-5
              text-white/85
              sm:line-clamp-5
              sm:text-[15px]
            "
          >
            {description}
          </p>

          {media.genres?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1 sm:gap-1.5">
              {media.genres
                .slice(0, 3)
                .map((g) => {
                  const id =
                    typeof g === "object"
                      ? g.id ?? g.slug
                      : g;

                  const name =
                    typeof g === "object"
                      ? g.name
                      : g;

                  return (
                    <Badge key={id}>
                      {name}
                    </Badge>
                  );
                })}
            </div>
          )}
        </div>
      </div>
      {/* اطلاعات پایین کارت */}


        <h3
          dir="ltr"
          className="
            text-center 
            mt-2.5
            truncate
            text-xs
            font-semibold
            text-white/90
            transition-colors
            group-hover:text-white
            sm:text-sm
          "
          >
          {media.original_title}
          {media.year && type=="movie" && <span> {media.year}</span>}
        </h3>

      {/* لایه مخصوص موبایل */}

      {mobileOpen && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            go();
          }}
          className="
            absolute
            inset-0
            z-40
            md:hidden
            bg-transparent
          "
          aria-label="مشاهده اطلاعات"
        />
      )}
    </article>
  );
}

// رندر دوباره‌ی کارت‌ها با هر تغییر state والد جلوی اسکرول روان را می‌گرفت
export default memo(MediaCard);
