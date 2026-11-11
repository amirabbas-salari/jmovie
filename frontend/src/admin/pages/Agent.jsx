import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  Bot, Check, Film, History, Play, Settings2, Sparkles, Tv, X,
} from "lucide-react"
import { agentApi, getApiError } from "../services/adminApi"
import { useAdmin } from "../context/AdminContext"
import { P } from "../permissions"
import { Badge, EmptyState, ErrorBox, PageHeader, Spinner, formatNumber } from "../components/ui"

const SOURCE_OPTIONS = [
  { value: "trending", label: "ترند هفته" },
  { value: "new", label: "جدیدترین‌ها" },
  { value: "popular", label: "محبوب‌ترین‌ها" },
  { value: "top_rated", label: "برترین‌های تاریخ" },
  { value: "custom", label: "منبع سفارشی (سایت من)" },
]

export default function Agent() {
  const { can, isSuperAdmin } = useAdmin()
  const canRun = isSuperAdmin || can(P.agentRun)

  const [settings, setSettings] = useState(null)
  const [drafts, setDrafts] = useState([])
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 })
  const [tab, setTab] = useState("pending")
  const [runs, setRuns] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, d, r] = await Promise.all([
        agentApi.getSettings(),
        agentApi.drafts({ status: tab }),
        agentApi.runs(),
      ])
      setSettings(s)
      setDrafts(d.results || [])
      setCounts(d.counts || { pending: 0, approved: 0, rejected: 0 })
      setRuns(Array.isArray(r) ? r : [])
      setSelected(new Set())
      setError("")
    } catch (err) {
      setError(getApiError(err))
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { load() }, [load])

  const toggleSource = (value) => {
    setSettings((prev) => {
      if (!prev) return prev
      const has = prev.sources.includes(value)
      return {
        ...prev,
        sources: has
          ? prev.sources.filter((s) => s !== value)
          : [...prev.sources, value],
      }
    })
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      const saved = await agentApi.updateSettings(settings)
      setSettings(saved)
      setNotice("تنظیمات ایجنت ذخیره شد.")
    } catch (err) {
      setError(getApiError(err))
    } finally {
      setSavingSettings(false)
    }
  }

  const runAgent = async () => {
    setRunning(true)
    setNotice("")
    try {
      const run = await agentApi.run({})
      setNotice(
        `اجرا تمام شد: ${formatNumber(run.created_movies)} فیلم و ${formatNumber(run.created_series)} سریال جدید به پیش‌نویس‌ها اضافه شد (${formatNumber(run.existing_skipped)} تکراری رد شد).`
      )
      await load()
    } catch (err) {
      setError(getApiError(err))
    } finally {
      setRunning(false)
    }
  }

  const act = async (id, action) => {
    try {
      await agentApi.act(id, action)
      await load()
    } catch (err) {
      setError(getApiError(err))
    }
  }

  const bulk = async (action) => {
    if (!selected.size) return
    try {
      await agentApi.bulk([...selected], action)
      await load()
    } catch (err) {
      setError(getApiError(err))
    }
  }

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div>
      <PageHeader
        title="ایجنت محتوا"
        subtitle="آوردن خودکار فیلم و سریال‌های جدید از TMDB به‌صورت پیش‌نویس؛ انتشار فقط با تأیید شما"
      />

      <ErrorBox message={error} />
      {notice && (
        <div className="mb-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {notice}
        </div>
      )}

      {/* اجرای ایجنت + تنظیمات */}
      <div className="mb-6 grid gap-4 lg:grid-cols-5">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 lg:col-span-2">
          <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-zinc-50">
            <Bot className="h-5 w-5 text-rose-400" /> اجرای ایجنت
          </h2>
          <p className="mb-4 text-xs leading-6 text-zinc-400">
            ایجنت از TMDB آثار جدید و محبوبی را که در سایت ندارید پیدا می‌کند،
            اطلاعات کامل و پوسترشان را می‌آورد و به‌صورت پیش‌نویس (مخفی) ذخیره
            می‌کند. اجرای زمان‌بندی روزانه هم با دستور
            <code dir="ltr" className="mx-1 rounded bg-black/40 px-1.5 py-0.5 text-[11px] text-rose-300">python manage.py run_content_agent</code>
            روی سرور فعال می‌شود.
          </p>
          <button
            type="button"
            onClick={runAgent}
            disabled={running || !canRun}
            className="btn-brand px-5 py-2.5 text-sm disabled:opacity-50"
          >
            {running ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Play className="h-4 w-4" />}
            {running ? "در حال آوردن آثار..." : "اجرای ایجنت"}
          </button>
          {!canRun && (
            <p className="mt-2 text-[11px] text-amber-300">
              برای اجرا/تأیید، مجوز «ایجنت محتوا» لازم است (سوپرادمین یا نقش دارای add_agentrun).
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 lg:col-span-3">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-zinc-50">
            <Settings2 className="h-5 w-5 text-rose-400" /> تنظیمات
          </h2>
          {!settings ? <Spinner /> : (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                {SOURCE_OPTIONS.map((opt) => {
                  const active = settings.sources.includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleSource(opt.value)}
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                        active
                          ? "border-transparent bg-gradient-to-l from-rose-500 to-violet-600 text-white"
                          : "border-white/15 bg-white/5 text-zinc-300 hover:bg-white/10"
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label className="text-xs text-zinc-400">
                  سقف هر اجرا
                  <input
                    type="number" min="1" max="100"
                    value={settings.max_items_per_run}
                    onChange={(e) => setSettings({ ...settings, max_items_per_run: Number(e.target.value) })}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100"
                  />
                </label>
                <label className="text-xs text-zinc-400">
                  حداقل امتیاز
                  <input
                    type="number" min="0" max="10" step="0.1"
                    value={settings.min_rating}
                    onChange={(e) => setSettings({ ...settings, min_rating: Number(e.target.value) })}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100"
                  />
                </label>
                <label className="text-xs text-zinc-400">
                  حداقل رأی
                  <input
                    type="number" min="0"
                    value={settings.min_votes}
                    onChange={(e) => setSettings({ ...settings, min_votes: Number(e.target.value) })}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100"
                  />
                </label>
                <label className="flex items-end gap-2 pb-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={settings.translate_with_ai}
                    onChange={(e) => setSettings({ ...settings, translate_with_ai: e.target.checked })}
                    className="h-4 w-4 accent-rose-500"
                  />
                  ترجمه با AI
                </label>
              </div>
              <label className="mt-4 block text-xs text-zinc-400">
                آدرس منبع کشف سفارشی (sitemap یا RSS سایت شما)
                <input
                  type="url"
                  dir="ltr"
                  placeholder="https://example.com/sitemap.xml"
                  value={settings.discovery_source_url || ""}
                  onChange={(e) => setSettings({ ...settings, discovery_source_url: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left text-sm text-zinc-100"
                />
                <span className="mt-1 block leading-5 text-zinc-500">
                  ایجنت فقط عنوان آثار این منبع را می‌خواند تا بفهمد چه چیزی را ندارید؛ اطلاعات کامل از TMDB می‌آید و لینک دانلود از منبع خوانده نمی‌شود (لینک را از پنل روی هر اثر می‌گذارید).
                </span>
              </label>
              <button
                type="button"
                onClick={saveSettings}
                disabled={savingSettings || !canRun}
                className="mt-4 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-100 transition hover:bg-white/10 disabled:opacity-50"
              >
                {savingSettings ? "در حال ذخیره..." : "ذخیره تنظیمات"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* تب‌های پیش‌نویس */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[
          { key: "pending", label: `در انتظار بررسی (${formatNumber(counts.pending)})` },
          { key: "approved", label: `تأیید شده (${formatNumber(counts.approved)})` },
          { key: "rejected", label: `رد شده (${formatNumber(counts.rejected)})` },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              tab === t.key
                ? "bg-gradient-to-l from-rose-500 to-violet-600 text-white"
                : "border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
            }`}
          >
            {t.label}
          </button>
        ))}
        {tab === "pending" && selected.size > 0 && (
          <span className="ms-auto flex gap-2">
            <button type="button" onClick={() => bulk("approve")} className="rounded-full bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25">
              تأیید {formatNumber(selected.size)} مورد
            </button>
            <button type="button" onClick={() => bulk("reject")} className="rounded-full bg-red-500/10 px-3.5 py-2 text-xs font-bold text-red-300 ring-1 ring-red-500/25 transition hover:bg-red-500/20">
              رد {formatNumber(selected.size)} مورد
            </button>
          </span>
        )}
      </div>

      {loading ? <Spinner /> : drafts.length === 0 ? (
        <EmptyState message={tab === "pending" ? "پیش‌نویسی در انتظار بررسی نیست؛ ایجنت را اجرا کنید." : "موردی اینجا نیست."} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {drafts.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
              <div className="relative aspect-[2/3] bg-zinc-900">
                {item.poster_url ? (
                  <img src={item.poster_url} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-zinc-600">
                    {item.media_type === "series" ? <Tv className="h-10 w-10" /> : <Film className="h-10 w-10" />}
                  </div>
                )}
                <span className="absolute right-2 top-2">
                  <Badge tone="amber">{item.media_type === "series" ? "سریال" : "فیلم"}{item.year ? ` • ${item.year}` : ""}</Badge>
                </span>
                {item.rating ? (
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-amber-300 backdrop-blur">
                    ★ {item.rating}
                  </span>
                ) : null}
                {tab === "pending" && (
                  <label className="absolute bottom-2 right-2 flex cursor-pointer items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-zinc-200 backdrop-blur">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="h-3.5 w-3.5 accent-rose-500"
                    />
                    انتخاب
                  </label>
                )}
              </div>
              <div className="p-3">
                <h3 className="truncate text-sm font-bold text-zinc-50">{item.title}</h3>
                <p dir="ltr" className="truncate text-left text-[11px] text-zinc-500">{item.original_title}</p>
                {tab === "pending" ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => act(item.id, "approve")} disabled={!canRun} className="flex items-center justify-center gap-1 rounded-xl bg-emerald-500/15 py-2 text-xs font-bold text-emerald-300 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/25 disabled:opacity-40">
                      <Check className="h-3.5 w-3.5" /> انتشار
                    </button>
                    <button type="button" onClick={() => act(item.id, "reject")} disabled={!canRun} className="flex items-center justify-center gap-1 rounded-xl bg-red-500/10 py-2 text-xs font-bold text-red-300 ring-1 ring-red-500/25 transition hover:bg-red-500/20 disabled:opacity-40">
                      <X className="h-3.5 w-3.5" /> رد
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-center text-[11px] text-zinc-500">
                    {item.status === "approved" ? "منتشر شده در سایت" : "رد شده — ایجنت دوباره نمی‌آوردش"}
                  </p>
                )}
                {item.admin_edit_path && (
                  <Link to={item.admin_edit_path} className="mt-2 block text-center text-[11px] font-semibold text-rose-300 hover:text-rose-200">
                    ویرایش در پنل (لینک دانلود و...)
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* تاریخچه اجرا */}
      <h2 className="mb-3 mt-8 flex items-center gap-2 text-base font-bold text-zinc-50">
        <History className="h-5 w-5 text-rose-400" /> تاریخچه‌ی اجراها
      </h2>
      {runs.length === 0 ? (
        <p className="text-sm text-zinc-500">هنوز اجرایی ثبت نشده است.</p>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-white/10">
          <table className="w-full min-w-[640px] text-right text-xs">
            <thead className="bg-white/[0.04] text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">نوع</th>
                <th className="px-4 py-3 font-semibold">وضعیت</th>
                <th className="px-4 py-3 font-semibold">پیدا شد</th>
                <th className="px-4 py-3 font-semibold">فیلم +</th>
                <th className="px-4 py-3 font-semibold">سریال +</th>
                <th className="px-4 py-3 font-semibold">تکراری</th>
                <th className="px-4 py-3 font-semibold">خطا</th>
                <th className="px-4 py-3 font-semibold">زمان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-zinc-300">
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="px-4 py-2.5">{run.id}</td>
                  <td className="px-4 py-2.5">{run.trigger_type === "scheduled" ? "زمان‌بندی" : `دستی${run.triggered_by_username ? ` (${run.triggered_by_username})` : ""}`}</td>
                  <td className="px-4 py-2.5">{run.status === "success" ? "✅ موفق" : run.status === "failed" ? "❌ ناموفق" : "⏳ در حال اجرا"}</td>
                  <td className="px-4 py-2.5">{formatNumber(run.found_count)}</td>
                  <td className="px-4 py-2.5">{formatNumber(run.created_movies)}</td>
                  <td className="px-4 py-2.5">{formatNumber(run.created_series)}</td>
                  <td className="px-4 py-2.5">{formatNumber(run.existing_skipped + run.blacklisted_skipped)}</td>
                  <td className="px-4 py-2.5">{formatNumber(run.failed_count)}</td>
                  <td className="px-4 py-2.5">{run.started_at ? new Date(run.started_at).toLocaleString("fa-IR") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
