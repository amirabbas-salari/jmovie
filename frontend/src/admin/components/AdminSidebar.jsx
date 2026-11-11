import { NavLink } from "react-router-dom"
import {
  Bot, Clapperboard, Download, Film, History, LayoutDashboard, Layers,
  MessageSquare, ShieldCheck, Tag, Users, X,
} from "lucide-react"
import { useAdmin } from "../context/AdminContext"
import { P } from "../permissions"

// آیتم‌ها بر اساس مجوز کاربر فیلتر می‌شوند؛ سوپرادمین همه را می‌بیند.
const NAV = [
  { to: "/admin", label: "داشبورد", icon: LayoutDashboard, end: true },
  { to: "/admin/movies", label: "فیلم‌ها", icon: Film, perm: P.movieView },
  { to: "/admin/series", label: "سریال‌ها", icon: Clapperboard, perm: P.seriesView },
  { to: "/admin/people", label: "افراد و بازیگران", icon: Users, perm: P.personView },
  { to: "/admin/genres", label: "ژانرها", icon: Tag, perm: P.genreView },
  { to: "/admin/collections", label: "کالکشن‌ها", icon: Layers, perm: P.collectionView },
  { to: "/admin/downloads", label: "لینک‌های دانلود", icon: Download, perm: P.downloadView },
  { to: "/admin/comments", label: "نظرات کاربران", icon: MessageSquare, perm: P.commentView },
  { to: "/admin/agent", label: "ایجنت محتوا", icon: Bot, perm: P.agentView },
  { to: "/admin/users", label: "کاربران", icon: Users, perm: P.userView },
  { to: "/admin/roles", label: "نقش‌ها و دسترسی‌ها", icon: ShieldCheck, superOnly: true },
  { to: "/admin/audit-logs", label: "لاگ فعالیت‌ها", icon: History, superOnly: true },
]

export default function AdminSidebar({ open, onClose }) {
  const { can, isSuperAdmin, me } = useAdmin()
  const items = NAV.filter((i) => (i.superOnly ? isSuperAdmin : can(i.perm)))

  return (
    <>
      {open && <div onClick={onClose} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" />}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-64 flex-col border-l border-white/10 bg-[#0b0b0e]/95 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-b from-[#C1121F] to-[#7F1D1D] text-white shadow-[0_8px_20px_-6px_rgba(193,18,31,0.8)]">
            <Clapperboard className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold text-zinc-100">جی‌مووی — مدیریت</p>
            <p className="text-[11px] text-zinc-500">{isSuperAdmin ? "سوپرادمین" : me?.roles?.[0]?.name || "ادمین"}</p>
          </div>
          <button onClick={onClose} className="ms-auto flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5 lg:hidden" aria-label="بستن منو">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-red-600/15 text-red-300"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`h-5 w-5 shrink-0 ${isActive ? "text-red-400" : ""}`} />
                    <span>{item.label}</span>
                    {isActive && <span className="ms-auto h-2 w-2 rounded-full bg-red-500" />}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-white/10 p-3 text-[11px] leading-5 text-zinc-600">
          سطح دسترسی شما توسط سوپرادمین تعیین می‌شود؛ بخش‌هایی که مجوزشان را ندارید نمایش داده نمی‌شوند.
        </div>
      </aside>
    </>
  )
}
