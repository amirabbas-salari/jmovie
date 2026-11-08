import { FiChevronLeft } from "react-icons/fi"

export default function SectionHeader({
  title,
  eyebrow,
  onSeeAll,
  actionLabel = "مشاهده همه",
  className = "px-4 sm:px-10 lg:px-16",
}) {
  return (
    <div className={`mb-5 flex items-end justify-between gap-4 ${className}`}>
      <div className="flex items-center gap-3">
        <span className="h-10 w-1.5 shrink-0 rounded-full bg-brand-gradient shadow-glow-sm" />
        <div>
          {eyebrow && <p className="section-eyebrow mb-1">{eyebrow}</p>}
          <h2 className="text-xl font-black tracking-tight text-white sm:text-[26px]">
            {title}
          </h2>
        </div>
      </div>

      {onSeeAll && (
        <button
          type="button"
          onClick={onSeeAll}
          className="btn-ghost group shrink-0 px-3.5 py-2 text-xs sm:text-sm"
        >
          {actionLabel}
          <FiChevronLeft className="transition-transform duration-300 group-hover:-translate-x-0.5" />
        </button>
      )}
    </div>
  )
}
