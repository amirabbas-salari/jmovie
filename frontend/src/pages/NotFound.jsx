import { useEffect, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Clapperboard, Film, Home, Layers, Loader2, Popcorn, Search, Ticket, Tv } from "lucide-react"
import api from "../services/api"

// صفحه‌ی ۴۰۴ با تم سینمایی سایت: پس‌زمینه‌ی تیره‌ی برند (#1A0B0C)،
// قرمز برند، فونت وزیرمتن و حال‌وهوای «فیلم گمشده».
const QUICK_LINKS = [
  { to: "/", label: "خانه", icon: Home },
  { to: "/movies", label: "فیلم‌ها", icon: Film },
  { to: "/series", label: "سریال‌ها", icon: Tv },
  { to: "/collection", label: "مجموعه‌ها", icon: Layers },
]

function FilmStrip({ side }) {
  // نوار فیلم تزئینی در دو لبه‌ی صفحه
  return (
    <div aria-hidden className={`pointer-events-none absolute top-0 hidden h-full w-10 flex-col items-center gap-4 py-4 opacity-[0.13] md:flex ${side === "right" ? "right-3" : "left-3"}`}>
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={i} className="h-6 w-5 shrink-0 rounded-[4px] bg-white" />
      ))}
    </div>
  )
}

export default function NotFound() {
  const navigate = useNavigate()
  const location = useLocation()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState({ movies: [], series: [], people: [] })
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // جستجوی زنده با همان API جستجوی سراسری سایت
  useEffect(() => {
    if (!query.trim()) {
      setResults({ movies: [], series: [], people: [] })
      setSearched(false)
      return
    }
    const t = setTimeout(async () => {
      try {
        setSearching(true)
        const { data } = await api.get("/search/", { params: { q: query.trim() } })
        setResults({
          movies: data.movies ?? [],
          series: data.series ?? [],
          people: data.people ?? [],
        })
        setSearched(true)
      } catch {
        setResults({ movies: [], series: [], people: [] })
        setSearched(true)
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [query])

  const suggestions = [
    ...results.movies.slice(0, 3).map((m) => ({ ...m, _to: `/movie/${m.slug}`, _kind: "فیلم" })),
    ...results.series.slice(0, 3).map((s) => ({ ...s, _to: `/series/${s.slug}`, _kind: "سریال" })),
    ...results.people.slice(0, 2).map((p) => ({ ...p, name: p.name, _to: `/person/${p.slug}`, _kind: "شخص" })),
  ]

  return (
    <div dir="rtl" className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-black via-[#140708] to-[#1A0B0C] px-4 py-16 font-sans text-zinc-100">
      {/* هاله‌های نور قرمز برند */}
      <div aria-hidden className="pointer-events-none absolute -top-32 right-1/4 h-96 w-96 rounded-full bg-red-700/20 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-rose-900/25 blur-[130px]" />
      <FilmStrip side="right" />
      <FilmStrip side="left" />

      <main className="relative z-10 w-full max-w-2xl text-center">
        {/* آیکون سینمایی */}
        <div className="mx-auto mb-6 flex h-20 w-20 rotate-[-6deg] items-center justify-center rounded-3xl border border-red-500/30 bg-gradient-to-b from-[#C1121F] to-[#7F1D1D] shadow-[0_20px_50px_-15px_rgba(193,18,31,0.8)]">
          <Clapperboard className="h-10 w-10 text-white" />
        </div>

        <p className="text-sm font-medium tracking-wide text-red-400">این سکانس در فیلم ما نیست!</p>

        <h1 className="mt-2 bg-gradient-to-b from-white via-zinc-200 to-zinc-500 bg-clip-text text-[110px] font-black leading-none text-transparent sm:text-[150px]">
          ۴۰۴
        </h1>

        <h2 className="mt-2 text-xl font-bold text-zinc-50 sm:text-2xl">
          صفحه‌ای که دنبالش بودی پیدا نشد
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-zinc-400">
          انگار این صحنه از نسخه‌ی نهایی حذف شده؛ شاید آدرس را اشتباه نوشته‌ای
          یا این صفحه جابه‌جا شده است. آدرس واردشده:
        </p>
        <p dir="ltr" className="mx-auto mt-2 w-fit max-w-full truncate rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-500">
          {location.pathname}
        </p>

        {/* جستجو */}
        <div className="relative mx-auto mt-8 max-w-lg">
          <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] p-2 backdrop-blur-xl transition focus-within:border-red-500/50 focus-within:ring-2 focus-within:ring-red-500/20">
            <Search className="mr-2 h-5 w-5 shrink-0 text-zinc-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && suggestions[0]) navigate(suggestions[0]._to)
              }}
              placeholder="اسم فیلم، سریال یا بازیگر را جستجو کن..."
              className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
            />
            {searching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-red-400" />}
          </div>

          {searched && (
            <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/95 text-right shadow-2xl backdrop-blur-xl">
              {suggestions.length === 0 ? (
                <p className="px-4 py-3.5 text-sm text-zinc-500">چیزی با این اسم پیدا نشد؛ یک اسم دیگر را امتحان کن.</p>
              ) : (
                <ul className="divide-y divide-white/5">
                  {suggestions.map((item) => (
                    <li key={`${item._kind}-${item.id}`}>
                      <Link to={item._to} className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/5">
                        <span className="rounded-md bg-red-600/15 px-2 py-0.5 text-[11px] font-medium text-red-300">{item._kind}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">{item.title || item.name}</span>
                        {item.year && <span className="text-[11px] text-zinc-500">{item.year}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* لینک‌های سریع */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                to === "/"
                  ? "bg-gradient-to-b from-[#C1121F] to-[#7F1D1D] font-semibold text-white shadow-[0_10px_25px_-8px_rgba(193,18,31,0.9)] hover:brightness-125"
                  : "border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>

        <p className="mt-10 flex items-center justify-center gap-2 text-xs text-zinc-600">
          <Ticket className="h-4 w-4" />
          یا از منوی بالای سایت به بخش موردنظرت برو
          <Popcorn className="h-4 w-4" />
        </p>
      </main>
    </div>
  )
}
