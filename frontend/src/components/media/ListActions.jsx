import { FiBookmark, FiCheck, FiHeart } from "react-icons/fi"
import { useMyLists } from "../../context/MyListsContext"

const LIST_META = {
  favorite: {
    label: "علاقه‌مندی‌ها",
    Icon: FiHeart,
    activeClass: "border-rose-400/50 bg-rose-600/40 text-rose-200",
  },
  watchlist: {
    label: "لیست تماشا",
    Icon: FiBookmark,
    activeClass: "border-sky-400/50 bg-sky-600/40 text-sky-200",
  },
  watched: {
    label: "دیده‌ام",
    Icon: FiCheck,
    activeClass: "border-emerald-400/50 bg-emerald-600/40 text-emerald-200",
  },
}

// دکمه‌های دایره‌ای روی پوستر کارت‌ها: قلب = علاقه‌مندی، بوکمارک = لیست تماشا
export function CardListButtons({ mediaId, type }) {
  const { isIn, toggle } = useMyLists()
  if (!mediaId || (type !== "movie" && type !== "series")) return null

  return (
    <div className="absolute right-1.5 top-1.5 z-30 flex flex-col gap-1.5 sm:right-2 sm:top-2">
      {["favorite", "watchlist"].map((list) => {
        const { label, Icon, activeClass } = LIST_META[list]
        const active = isIn(list, type, mediaId)
        return (
          <button
            key={list}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              toggle(list, type, mediaId)
            }}
            aria-label={active ? `حذف از ${label}` : `افزودن به ${label}`}
            aria-pressed={active}
            title={label}
            className={`
              grid h-8 w-8 place-items-center rounded-full border text-white
              shadow-[0_4px_14px_rgba(0,0,0,0.55)] transition-all duration-300
              hover:scale-110 active:scale-90 sm:h-9 sm:w-9
              ${active
                ? activeClass
                : "border-white/30 bg-black/35 hover:bg-black/55 sm:backdrop-blur-md"}
            `}
          >
            <Icon className={`text-base sm:text-lg ${active ? "fill-current" : ""}`} />
          </button>
        )
      })}
    </div>
  )
}

// دکمه‌های کپسولی صفحه‌ی جزئیات: هر سه لیست با برچسب متنی
export function DetailListActions({ mediaId, type, className = "" }) {
  const { isIn, toggle } = useMyLists()
  if (!mediaId || (type !== "movie" && type !== "series")) return null

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} dir="rtl">
      {Object.entries(LIST_META).map(([list, { label, Icon, activeClass }]) => {
        const active = isIn(list, type, mediaId)
        return (
          <button
            key={list}
            type="button"
            onClick={() => toggle(list, type, mediaId)}
            aria-pressed={active}
            className={`
              inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2
              text-xs font-semibold text-white transition-all duration-300
              hover:scale-[1.04] active:scale-95 sm:text-sm
              ${active
                ? activeClass
                : "border-white/25 bg-white/10 hover:bg-white/20 sm:backdrop-blur-md"}
            `}
          >
            <Icon className={active ? "fill-current" : ""} />
            {label}
            {active && <FiCheck className="text-[10px] opacity-80" />}
          </button>
        )
      })}
    </div>
  )
}
