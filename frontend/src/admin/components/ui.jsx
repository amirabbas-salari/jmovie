import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronLeft, ChevronRight, Loader2, Plus, Search, Trash2, X } from "lucide-react"

// تم پنل دقیقاً از تم سایت می‌آید: پس‌زمینه‌ی تیره + گرادیان قرمز برند
// (#C1121F → #7F1D1D در اسکرول‌بار و دکمه‌های سایت) و فونت وزیرمتن.
export const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-red-500/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-red-500/20"
export const labelCls = "mb-1.5 block text-xs font-medium text-zinc-400"
export const cardCls = "rounded-2xl border border-white/10 bg-white/[0.03]"

export const PrimaryBtn = ({ children, className = "", ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#C1121F] via-[#9D174D] to-[#7F1D1D] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(193,18,31,0.7)] transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
  >
    {children}
  </button>
)

export const GhostBtn = ({ children, className = "", ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/10 disabled:opacity-50 ${className}`}
  >
    {children}
  </button>
)

export function PageHeader({ title, subtitle, actionTo, actionLabel, actionPerm, can }) {
  const showAction = actionTo && (can ? can(actionPerm) : true)
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4">
      <div>
        <h1 className="text-xl font-bold text-zinc-50 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {showAction && (
        <Link to={actionTo} className="ms-auto">
          <PrimaryBtn>
            <Plus className="h-4 w-4" /> {actionLabel}
          </PrimaryBtn>
        </Link>
      )}
    </div>
  )
}

export function Field({ label, error, children, hint }) {
  return (
    <div>
      {label && <label className={labelCls}>{label}</label>}
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-zinc-600">{hint}</p>}
      {error && <p className="mt-1 text-[11px] text-red-400">{Array.isArray(error) ? error[0] : error}</p>}
    </div>
  )
}

export function Toggle({ label, desc, checked, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-right transition hover:bg-white/[0.06] disabled:opacity-50"
    >
      <span>
        <span className="block text-sm font-medium text-zinc-200">{label}</span>
        {desc && <span className="mt-0.5 block text-[11px] text-zinc-500">{desc}</span>}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-red-600" : "bg-zinc-700"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? "right-[22px]" : "right-0.5"}`} />
      </span>
    </button>
  )
}

export function SearchBox({ value, onChange, placeholder = "جستجو..." }) {
  return (
    <div className="relative min-w-[200px] flex-1">
      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputCls} pr-9`} />
    </div>
  )
}

export function Pagination({ page, total, pageSize, onChange }) {
  const pages = Math.max(1, Math.ceil((total || 0) / pageSize))
  if (pages <= 1) return null
  return (
    <div className="mt-5 flex items-center justify-center gap-2">
      <GhostBtn disabled={page <= 1} onClick={() => onChange(page - 1)} className="!px-3">
        <ChevronRight className="h-4 w-4" /> قبلی
      </GhostBtn>
      <span className="text-xs text-zinc-500">صفحه {page} از {pages} — {total} مورد</span>
      <GhostBtn disabled={page >= pages} onClick={() => onChange(page + 1)} className="!px-3">
        بعدی <ChevronLeft className="h-4 w-4" />
      </GhostBtn>
    </div>
  )
}

export function ConfirmModal({ title, message, loading, onCancel, onConfirm, confirmLabel = "حذف" }) {
  if (!message && !title) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={loading ? undefined : onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/15 text-red-400">
            <Trash2 className="h-5 w-5" />
          </span>
          <h3 className="font-bold text-zinc-100">{title}</h3>
        </div>
        <p className="mb-6 text-sm leading-6 text-zinc-400">{message}</p>
        <div className="flex gap-3">
          <GhostBtn onClick={onCancel} disabled={loading} className="flex-1">انصراف</GhostBtn>
          <PrimaryBtn onClick={onConfirm} disabled={loading} className="flex-1">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  )
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative max-h-[90vh] w-full ${wide ? "max-w-2xl" : "max-w-lg"} overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl`}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-bold text-zinc-100">{title}</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10" aria-label="بستن">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export const Spinner = ({ text = "در حال بارگذاری..." }) => (
  <div className="flex min-h-[40vh] items-center justify-center gap-3 text-sm text-zinc-400">
    <Loader2 className="h-5 w-5 animate-spin text-red-500" /> {text}
  </div>
)

export const EmptyState = ({ text = "موردی یافت نشد." }) => (
  <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center text-sm text-zinc-500">{text}</div>
)

export const ErrorBox = ({ message }) =>
  message ? (
    <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{message}</div>
  ) : null

export const Badge = ({ children, tone = "zinc" }) => {
  const tones = {
    zinc: "bg-white/5 text-zinc-400 border-white/10",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  }
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>{children}</span>
}

export function useDebounced(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  const timer = useRef(null)
  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer.current)
  }, [value, delay])
  return debounced
}

// هوک مشترک لیست‌های پنل: جستجوی debounce‌شده + صفحه‌بندی سمت سرور
export function useAdminList(fetcher, deps = []) {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const debounced = useDebounced(search)
  const pageSize = 24

  const fetcherRef = useRef(fetcher)
  useEffect(() => { fetcherRef.current = fetcher })
  const depsKey = JSON.stringify(deps)

  const load = useCallback(
    () => fetcherRef.current({ search: debounced || undefined, page }),
    // depsKey عمداً به‌جای deps آمده تا هویت load فقط با تغییر واقعی فیلترها عوض شود
    [debounced, page, depsKey] // eslint-disable-line react-hooks/exhaustive-deps
  )

  useEffect(() => { setPage(1) }, [debounced, depsKey])

  useEffect(() => {
    let alive = true
    setLoading(true)
    load()
      .then((data) => { if (alive) { setItems(data.items); setTotal(data.total); setError("") } })
      .catch((e) => { if (alive) setError(e?.response?.data?.detail || "خطا در دریافت اطلاعات") })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [load])

  return { items, setItems, total, loading, error, search, setSearch, page, setPage, pageSize, reload: load }
}

export const formatNumber = (n) => new Intl.NumberFormat("fa-IR").format(Number(n || 0))
export const thumbOf = (item) =>
  item?.poster_display || item?.display_image || item?.poster_url || item?.profile_image_url || null
