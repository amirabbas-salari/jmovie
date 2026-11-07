import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Bell, ChevronDown, Home, LogOut, Menu, Search, ShieldCheck, User } from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { useAdmin } from "../context/AdminContext"
import { commentsApi } from "../services/adminApi"

const TITLES = [
  [/^\/admin\/?$/, "داشبورد"],
  [/movies/, "فیلم‌ها"],
  [/series/, "سریال‌ها"],
  [/people/, "افراد و بازیگران"],
  [/genres/, "ژانرها"],
  [/collections/, "کالکشن‌ها"],
  [/downloads/, "لینک‌های دانلود"],
  [/comments/, "نظرات کاربران"],
  [/users/, "کاربران"],
  [/roles/, "نقش‌ها و دسترسی‌ها"],
  [/audit-logs/, "لاگ فعالیت‌ها"],
]

export default function AdminTopbar({ onMenuClick }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [pendingCount, setPendingCount] = useState(0)
  const { logout } = useAuth()
  const { me, isSuperAdmin, can } = useAdmin()
  const menuRef = useRef(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const title = TITLES.find(([re]) => re.test(pathname))?.[1] || "پنل مدیریت"

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  useEffect(() => {
    if (!can("comments.view_comment")) return
    let alive = true
    commentsApi.list({ status: "pending", page_size: 1 })
      .then((d) => { if (alive) setPendingCount(d.total) })
      .catch(() => {})
    return () => { alive = false }
  }, [can, pathname])

  const handleSearch = (e) => {
    e.preventDefault()
    if (query.trim()) navigate(`/admin/movies?search=${encodeURIComponent(query.trim())}`)
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/10 bg-[#09090b]/80 px-4 backdrop-blur-xl sm:px-6">
      <button
        onClick={onMenuClick}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 lg:hidden"
        aria-label="باز کردن منو"
      >
        <Menu className="h-5 w-5" />
      </button>

      <h1 className="hidden text-lg font-bold text-zinc-100 sm:block">{title}</h1>
      {isSuperAdmin && (
        <span className="hidden items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-300 md:inline-flex">
          <ShieldCheck className="h-3.5 w-3.5" /> سوپرادمین
        </span>
      )}

      <form onSubmit={handleSearch} className="relative ms-auto w-full max-w-xs">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجوی فیلم..."
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pr-9 pl-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-red-500/40 focus:bg-white/10"
        />
      </form>

      <button
        onClick={() => navigate("/admin/comments?status=pending")}
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10"
        aria-label="نظرات در انتظار تأیید"
        title="نظرات در انتظار تأیید"
      >
        <Bell className="h-5 w-5" />
        {pendingCount > 0 && (
          <span className="absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {pendingCount > 99 ? "۹۹+" : pendingCount}
          </span>
        )}
      </button>

      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 py-1.5 pr-1.5 pl-2 text-sm transition hover:bg-white/10"
        >
          <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg bg-red-600/20 text-red-300">
            {me?.avatar ? <img src={me.avatar} alt="" className="h-full w-full object-cover" /> : <User className="h-4 w-4" />}
          </span>
          <span className="hidden font-medium text-zinc-200 sm:block">{me?.username || "..."}</span>
          <ChevronDown className={`h-4 w-4 text-zinc-500 transition ${menuOpen ? "rotate-180" : ""}`} />
        </button>

        {menuOpen && (
          <div className="absolute left-0 mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-zinc-900/95 py-1 shadow-xl backdrop-blur-xl">
            <div className="border-b border-white/10 px-4 py-3">
              <p className="text-sm font-medium text-zinc-100">{me?.username}</p>
              <p className="truncate text-xs text-zinc-500">{me?.email}</p>
              <p className="mt-1 text-[11px] text-red-400">
                {isSuperAdmin ? "سوپرادمین — دسترسی کامل" : me?.roles?.map((r) => r.name).join("، ") || "بدون نقش"}
              </p>
            </div>
            <button onClick={() => { setMenuOpen(false); navigate("/profile") }} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5">
              <User className="h-4 w-4 text-zinc-500" /> پروفایل من
            </button>
            <button onClick={() => { setMenuOpen(false); navigate("/") }} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5">
              <Home className="h-4 w-4 text-zinc-500" /> مشاهده‌ی سایت
            </button>
            <button onClick={logout} className="flex w-full items-center gap-2 border-t border-white/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-500/10">
              <LogOut className="h-4 w-4" /> خروج
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
