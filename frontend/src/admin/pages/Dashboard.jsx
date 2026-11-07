import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  Check, Clapperboard, Download, Eye, Film, Layers, MessageSquare,
  ShieldCheck, Star, Tag, UserCheck, Users, X,
} from "lucide-react"
import { commentsApi, getAdminDashboard } from "../services/adminApi"
import { useAdmin } from "../context/AdminContext"
import { Badge, ErrorBox, Spinner, formatNumber } from "../components/ui"

function StatCard({ icon: StatIcon, label, value, to, accent = "bg-red-600/15 text-red-400" }) {
  const body = (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-red-500/30 hover:bg-white/[0.05]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-zinc-50">{formatNumber(value)}</p>
        </div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent}`}>
          <StatIcon className="h-5 w-5" />
        </span>
      </div>
    </div>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

export default function Dashboard() {
  const { me, isSuperAdmin } = useAdmin()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [pending, setPending] = useState([])

  useEffect(() => {
    let alive = true
    getAdminDashboard()
      .then((d) => {
        if (!alive) return
        if (!d || typeof d !== "object" || !d.stats) {
          setError("پاسخ داشبورد از سرور معتبر نیست — آدرس API (VITE_API_BASE_URL) یا وضعیت بک‌اند را بررسی کنید.")
          return
        }
        setData(d)
        setPending(d.pending_comments || [])
      })
      .catch((err) => {
        if (alive) setError(err?.message || "خطا در دریافت آمار داشبورد — اتصال به بک‌اند را بررسی کنید.")
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const moderate = async (comment, approve) => {
    try {
      if (approve) await commentsApi.approve(comment.id)
      else await commentsApi.reject(comment.id)
      setPending((p) => p.filter((c) => c.id !== comment.id))
    } catch { /* بک‌اند خطا را برمی‌گرداند؛ لیست دست‌نخورده می‌ماند */ }
  }

  if (loading) return <Spinner text="در حال بارگذاری داشبورد..." />
  if (error) return <ErrorBox message={error} />
  const s = data.stats

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-l from-[#7F1D1D] via-[#3f0d18] to-zinc-950 p-6">
        <h1 className="text-xl font-bold text-white sm:text-2xl">
          سلام {me?.username} 👋
        </h1>
        <p className="mt-1.5 text-sm text-zinc-300">
          {isSuperAdmin
            ? "شما سوپرادمین هستید و به همه‌ی بخش‌ها دسترسی دارید؛ سطح دسترسی بقیه‌ی ادمین‌ها را از بخش «نقش‌ها و دسترسی‌ها» تعیین کنید."
            : `نقش شما: ${me?.roles?.map((r) => r.name).join("، ") || "—"} — فقط بخش‌هایی که مجوزشان را دارید برایتان باز است.`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="red"><Eye className="h-3 w-3" /> مجموع بازدید: {formatNumber(s.total_views)}</Badge>
          <Badge tone="amber"><MessageSquare className="h-3 w-3" /> {formatNumber(s.comments_pending)} نظر در انتظار تأیید</Badge>
          <Badge><UserCheck className="h-3 w-3" /> {formatNumber(s.vip_users)} کاربر VIP</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Film} label="فیلم‌ها" value={s.movies} to="/admin/movies" />
        <StatCard icon={Clapperboard} label="سریال‌ها" value={s.series} to="/admin/series" accent="bg-amber-500/15 text-amber-400" />
        <StatCard icon={Users} label="کاربران" value={s.users} to="/admin/users" accent="bg-sky-500/15 text-sky-400" />
        <StatCard icon={Download} label="لینک دانلود فعال" value={s.downloads} to="/admin/downloads" accent="bg-emerald-500/15 text-emerald-400" />
        <StatCard icon={Clapperboard} label="قسمت‌ها" value={s.episodes} accent="bg-violet-500/15 text-violet-400" />
        <StatCard icon={Tag} label="ژانرها" value={s.genres} to="/admin/genres" accent="bg-pink-500/15 text-pink-400" />
        <StatCard icon={Layers} label="کالکشن‌ها" value={s.collections} to="/admin/collections" accent="bg-teal-500/15 text-teal-400" />
        <StatCard icon={ShieldCheck} label="ادمین‌ها و همکاران" value={s.staff_users} to="/admin/users?role=staff" accent="bg-orange-500/15 text-orange-400" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 xl:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-zinc-100">نظرات در انتظار تأیید</h2>
            <Link to="/admin/comments?status=pending" className="text-xs text-red-400 hover:text-red-300">مشاهده همه</Link>
          </div>
          {pending.length === 0
            ? <p className="py-6 text-center text-sm text-zinc-500">🎉 نظری در انتظار نیست.</p>
            : (
              <ul className="space-y-3">
                {pending.map((c) => (
                  <li key={c.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
                    <p className="text-xs text-zinc-500">{c.username} — روی «{c.target_title}»</p>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-200">{c.text}</p>
                    <div className="mt-2.5 flex gap-2">
                      <button onClick={() => moderate(c, true)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/20 px-2.5 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-600/30">
                        <Check className="h-3.5 w-3.5" /> تأیید
                      </button>
                      <button onClick={() => moderate(c, false)} className="inline-flex items-center gap-1 rounded-lg bg-red-600/20 px-2.5 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-600/30">
                        <X className="h-3.5 w-3.5" /> رد
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-4 font-bold text-zinc-100">آخرین فیلم‌ها</h2>
          <ul className="space-y-2.5">
            {(data.latest_movies || []).map((m) => (
              <li key={m.id}>
                <Link to={`/admin/movies/${m.id}/edit`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-white/5">
                  {m.poster_display
                    ? <img src={m.poster_display} alt="" loading="lazy" className="h-12 w-9 rounded-md object-cover" />
                    : <span className="h-12 w-9 rounded-md bg-white/5" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-100">{m.title}</span>
                    <span className="text-[11px] text-zinc-500">{m.year || "—"}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-amber-300"><Star className="h-3.5 w-3.5 fill-amber-300" />{m.imdb_rating || "—"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-4 font-bold text-zinc-100">فعالیت‌های اخیر پنل</h2>
          {data.recent_activity.length === 0
            ? <p className="py-6 text-center text-sm text-zinc-500">هنوز فعالیتی ثبت نشده است.</p>
            : (
              <ul className="space-y-3">
                {data.recent_activity.map((log) => (
                  <li key={log.id} className="flex items-start gap-3 text-sm">
                    <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${log.action === "delete" ? "bg-red-500" : log.action === "create" ? "bg-emerald-500" : "bg-amber-400"}`} />
                    <span className="min-w-0">
                      <span className="block truncate text-zinc-200">
                        {log.username} — {{ create: "ساخت", update: "ویرایش", delete: "حذف" }[log.action]} «{log.object_repr}»
                      </span>
                      <span className="text-[11px] text-zinc-500">{new Date(log.created_at).toLocaleString("fa-IR")}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
        </section>
      </div>
    </div>
  )
}
