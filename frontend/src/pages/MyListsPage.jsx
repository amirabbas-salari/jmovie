import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { FiBookmark, FiCheck, FiHeart, FiLoader } from "react-icons/fi"
import api from "../services/api"
import MediaCard from "../components/media/MediaCard"
import { useMyLists } from "../context/MyListsContext"

const TABS = [
  { key: "favorite", label: "علاقه‌مندی‌ها", Icon: FiHeart, emptyHint: "هنوز فیلمی را به علاقه‌مندی‌ها اضافه نکرده‌اید؛ روی قلبِ کارت هر فیلم یا سریال بزنید." },
  { key: "watchlist", label: "لیست تماشا", Icon: FiBookmark, emptyHint: "لیست تماشای شما خالی است؛ با دکمه‌ی بوکمارک روی کارت‌ها، فیلم‌هایی را که می‌خواهید بعداً ببینید اینجا نگه دارید." },
  { key: "watched", label: "دیده‌شده‌ها", Icon: FiCheck, emptyHint: "هنوز اثری را به‌عنوان دیده‌شده علامت نزده‌اید؛ از صفحه‌ی جزئیات هر اثر می‌توانید این کار را انجام دهید." },
]

export default function MyListsPage() {
  const [activeTab, setActiveTab] = useState("favorite")
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  // وضعیت زنده‌ی دکمه‌ها؛ آیتمی که از همین صفحه حذف شود بلافاصله ناپدید می‌شود
  const { isIn } = useMyLists()

  useEffect(() => {
    let alive = true
    api
      .get("/accounts/my-lists/", { skipCache: true })
      .then((res) => alive && setData(res.data))
      .catch(() => alive && setError("خطا در دریافت لیست‌ها؛ دوباره تلاش کنید."))
    return () => {
      alive = false
    }
  }, [])

  const visible = useMemo(() => {
    const items = data?.[activeTab] ?? []
    return items.filter(
      (item) => item.media && isIn(activeTab, item.media_type, item.media.id)
    )
  }, [data, activeTab, isIn])

  const counts = useMemo(() => {
    const result = {}
    for (const tab of TABS) {
      result[tab.key] = (data?.[tab.key] ?? []).filter(
        (item) => item.media && isIn(tab.key, item.media_type, item.media.id)
      ).length
    }
    return result
  }, [data, isIn])

  const activeMeta = TABS.find((t) => t.key === activeTab)

  return (
    <div dir="rtl" className="min-h-screen bg-[#1A0B0C] px-4 pb-24 pt-28 text-white sm:px-8 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <h1 className="text-2xl font-black sm:text-4xl">لیست‌های من</h1>
          <p className="mt-2 text-sm text-white/60">
            فیلم‌ها و سریال‌هایی که ذخیره کرده‌اید، همه اینجاست.
          </p>
        </header>

        {/* تب‌ها */}
        <div className="mb-8 flex flex-wrap gap-2">
          {TABS.map(({ key, label, Icon }) => {
            const active = key === activeTab
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                aria-pressed={active}
                className={`
                  inline-flex items-center gap-2 rounded-full border px-4 py-2.5
                  text-sm font-semibold transition-all duration-300 active:scale-95
                  ${active
                    ? "border-rose-500/60 bg-rose-600/25 text-white shadow-[0_8px_25px_rgba(225,29,72,0.25)]"
                    : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"}
                `}
              >
                <Icon className={active ? "fill-current" : ""} />
                {label}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? "bg-rose-500 text-white" : "bg-white/10 text-white/60"}`}>
                  {counts[key] ?? 0}
                </span>
              </button>
            )
          })}
        </div>

        {error && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </p>
        )}

        {!data && !error ? (
          <div className="flex items-center justify-center gap-3 py-24 text-white/60">
            <FiLoader className="animate-spin text-xl" />
            در حال بارگذاری لیست‌ها...
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
            <activeMeta.Icon className="mx-auto mb-4 text-4xl text-rose-400/70" />
            <p className="mx-auto max-w-md text-sm leading-7 text-white/65">
              {activeMeta.emptyHint}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/movies"
                className="rounded-full bg-gradient-to-r from-rose-500 to-[#751a6c] px-5 py-2.5 text-sm font-bold text-white transition hover:scale-[1.03] active:scale-95"
              >
                مرور فیلم‌ها
              </Link>
              <Link
                to="/series"
                className="rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-95"
              >
                مرور سریال‌ها
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 justify-items-center gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {visible.map((item) => (
              <MediaCard
                key={`${item.media_type}-${item.media.id}`}
                media={item.media}
                type={item.media_type}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
