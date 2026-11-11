import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { CheckSquare, Eraser, Loader2, Pencil, Star, Trash2 } from "lucide-react"
import { useAdmin } from "../context/AdminContext"
import { getApiError } from "../services/adminApi"
import {
  Badge, ConfirmModal, EmptyState, ErrorBox, PageHeader, Pagination,
  SearchBox, Spinner, formatNumber, thumbOf, useAdminList,
} from "./ui"

// لیست مشترک فیلم/سریال: جستجو + صفحه‌بندی + حذف تکی/گروهی با تأیید
// + پاکسازی یکجای آثاری که هیچ لینک دانلودی ندارند.
export default function MediaListPage({ title, subtitle, basePath, api, perms, kindLabel }) {
  const { can } = useAdmin()
  const [searchParams] = useSearchParams()
  const list = useAdminList((params) => api.list(params))
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [selected, setSelected] = useState(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [purgeCount, setPurgeCount] = useState(null)
  const [confirmPurge, setConfirmPurge] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const [actionError, setActionError] = useState("")

  const canDelete = can(perms.delete)

  // جستجوی تاپ‌بار (?search=) را به جستجوی لیست وصل می‌کند
  useEffect(() => {
    const q = searchParams.get("search")
    if (q) list.setSearch(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // با عوض شدن صفحه/جستجو، انتخاب‌ها از نو شروع می‌شوند
  useEffect(() => { setSelected(new Set()) }, [list.page, list.search])

  const refresh = async () => {
    const data = await list.reload()
    list.setItems(data.items)
    list.setTotal(data.total)
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await api.remove(toDelete.id)
      list.setItems((prev) => prev.filter((m) => m.id !== toDelete.id))
      setToDelete(null)
    } finally {
      setDeleting(false)
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

  const allOnPageSelected =
    list.items.length > 0 && list.items.every((m) => selected.has(m.id))

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) list.items.forEach((m) => next.delete(m.id))
      else list.items.forEach((m) => next.add(m.id))
      return next
    })
  }

  const confirmBulkDelete = async () => {
    setBusy(true)
    setActionError("")
    try {
      const res = await api.bulkDelete([...selected])
      setNotice(`${formatNumber(res.deleted)} ${kindLabel} حذف شد.`)
      setSelected(new Set())
      setConfirmBulk(false)
      await refresh()
    } catch (err) {
      setActionError(getApiError(err))
      setConfirmBulk(false)
    } finally {
      setBusy(false)
    }
  }

  const [purgeItems, setPurgeItems] = useState([])
  const [purgeLoading, setPurgeLoading] = useState(false)

  const startPurge = async () => {
    // بدون فیدبک «در حال بررسی» کاربر فکر می‌کرد دکمه کار نمی‌کند؛ روی
    // داده‌ی حجیم پاسخ سرور ممکن است چند ثانیه طول بکشد.
    if (purgeLoading) return
    setActionError("")
    setPurgeLoading(true)
    try {
      const res = await api.withoutDownloads()
      setPurgeCount(res.count)
      setPurgeItems(res.results || [])
      setConfirmPurge(true)
    } catch (err) {
      setActionError(getApiError(err))
    } finally {
      setPurgeLoading(false)
    }
  }

  const confirmPurgeAction = async () => {
    setBusy(true)
    setActionError("")
    try {
      const res = await api.purgeWithoutDownloads()
      setNotice(`${formatNumber(res.deleted)} ${kindLabel} بدون لینک دانلود حذف شد.`)
      setConfirmPurge(false)
      await refresh()
    } catch (err) {
      setActionError(getApiError(err))
      setConfirmPurge(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} actionTo={`${basePath}/new`} actionLabel={`افزودن ${kindLabel}`} actionPerm={perms.add} can={can} />

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="min-w-52 flex-1">
          <SearchBox value={list.search} onChange={list.setSearch} placeholder={`جستجوی ${kindLabel} (عنوان، IMDb ID)...`} />
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={startPurge}
            disabled={purgeLoading}
            aria-busy={purgeLoading}
            className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-wait disabled:opacity-60"
          >
            {purgeLoading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Eraser className="h-4 w-4" />}
            {purgeLoading
              ? "در حال بررسی لینک‌های دانلود..."
              : `حذف ${kindLabel}های بدون لینک دانلود`}
          </button>
        )}
      </div>

      {canDelete && selected.size > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <CheckSquare className="h-4 w-4 text-red-300" />
            {formatNumber(selected.size)} {kindLabel} انتخاب شده
          </span>
          <span className="ms-auto flex gap-2">
            <button type="button" onClick={() => setConfirmBulk(true)} className="rounded-lg bg-red-500/20 px-3.5 py-2 text-xs font-bold text-red-200 ring-1 ring-red-500/40 transition hover:bg-red-500/30">
              حذف انتخاب‌شده‌ها
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10">
              لغو انتخاب
            </button>
          </span>
        </div>
      )}

      <ErrorBox message={list.error || actionError} />
      {notice && (
        <div className="mb-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {notice}
        </div>
      )}

      {list.loading ? <Spinner /> : list.items.length === 0 ? <EmptyState /> : (
        <>
          {canDelete && (
            <label className="mb-3 flex w-fit cursor-pointer items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={allOnPageSelected}
                onChange={toggleSelectAll}
                className="h-4 w-4 accent-red-500"
              />
              انتخاب همه‌ی این صفحه
            </label>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {list.items.map((item) => {
              const thumb = thumbOf(item)
              const isSelected = selected.has(item.id)
              return (
                <div key={item.id} className={`group overflow-hidden rounded-2xl border bg-white/[0.03] transition ${isSelected ? "border-red-500/60 ring-1 ring-red-500/40" : "border-white/10 hover:border-red-500/30"}`}>
                  <div className="relative aspect-[2/3] bg-zinc-900">
                    {thumb
                      ? <img src={thumb} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
                      : <div className="flex h-full items-center justify-center text-xs text-zinc-600">بدون پوستر</div>}
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-amber-300 backdrop-blur">
                      <Star className="h-3 w-3 fill-amber-300" /> {item.imdb_rating || "—"}
                    </span>
                    {item.is_active === false && <span className="absolute left-2 top-2"><Badge tone="red">غیرفعال</Badge></span>}
                    {canDelete && (
                      <label className="absolute bottom-2 right-2 flex cursor-pointer items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] text-zinc-100 backdrop-blur">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.id)}
                          className="h-3.5 w-3.5 accent-red-500"
                          aria-label={`انتخاب ${item.title}`}
                        />
                        انتخاب
                      </label>
                    )}
                  </div>
                  <div className="p-3.5">
                    <p className="truncate text-sm font-semibold text-zinc-100">{item.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-zinc-500" dir="ltr" style={{ textAlign: "right" }}>{item.original_title || item.slug}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(item.genres || []).slice(0, 3).map((g) => <Badge key={g.id}>{g.name}</Badge>)}
                    </div>
                    <p className="mt-2 text-[11px] text-zinc-500">
                      {item.year || item.start_date?.slice(0, 4) || "—"} • بازدید: {formatNumber(item.views)}
                      {item.seasons_count != null && <> • {formatNumber(item.seasons_count)} فصل</>}
                    </p>
                    <div className="mt-3 flex gap-2">
                      {can(perms.change) && (
                        <Link to={`${basePath}/${item.id}/edit`} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2 text-xs font-medium text-zinc-200 transition hover:bg-white/10">
                          <Pencil className="h-3.5 w-3.5" /> ویرایش
                        </Link>
                      )}
                      {canDelete && (
                        <button onClick={() => setToDelete(item)} className="flex items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 px-3 text-red-400 transition hover:bg-red-500/20" aria-label={`حذف ${item.title}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <Pagination page={list.page} total={list.total} pageSize={list.pageSize} onChange={list.setPage} />
        </>
      )}

      {toDelete && (
        <ConfirmModal
          title={`حذف ${kindLabel}`}
          message={`«${toDelete.title}» و همه‌ی اطلاعات وابسته‌اش (عوامل، گالری، لینک‌ها) حذف شود؟ این عمل قابل بازگشت نیست.`}
          loading={deleting}
          onCancel={() => setToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}

      {confirmBulk && (
        <ConfirmModal
          title={`حذف گروهی ${kindLabel}ها`}
          message={`${formatNumber(selected.size)} ${kindLabel} انتخاب‌شده همراه با همه‌ی اطلاعات وابسته‌شان (عوامل، گالری، لینک‌های دانلود) حذف شوند؟ این عمل قابل بازگشت نیست.`}
          loading={busy}
          onCancel={() => setConfirmBulk(false)}
          onConfirm={confirmBulkDelete}
        />
      )}

      {confirmPurge && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={busy ? undefined : () => setConfirmPurge(false)} />
          <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="mb-2 font-bold text-zinc-100">
              حذف {kindLabel}های بدون لینک دانلود
            </h3>
            {purgeCount === 0 ? (
              <p className="mb-6 text-sm text-zinc-400">
                هیچ {kindLabel}ی بدون لینک دانلود پیدا نشد. (لینک‌های روی قسمت‌ها و فصل‌های سریال هم حساب شده‌اند.)
              </p>
            ) : (
              <>
                <p className="mb-3 text-sm leading-6 text-zinc-400">
                  {formatNumber(purgeCount)} {kindLabel} زیر هیچ لینک دانلودی ندارند
                  (نه روی خودشان، نه فصل‌ها و نه قسمت‌ها) و با همه‌ی اطلاعات وابسته حذف می‌شوند.
                  این عمل قابل بازگشت نیست:
                </p>
                <ul className="mb-5 flex-1 space-y-1.5 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-3 text-sm">
                  {purgeItems.map((m) => (
                    <li key={m.id} className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-zinc-200">{m.title}</span>
                      <span className="shrink-0 text-[11px] text-zinc-500" dir="ltr">
                        {m.original_title}{m.year ? ` (${m.year})` : ""}
                      </span>
                    </li>
                  ))}
                  {purgeCount > purgeItems.length && (
                    <li className="pt-1 text-[11px] text-zinc-500">
                      و {formatNumber(purgeCount - purgeItems.length)} مورد دیگر…
                    </li>
                  )}
                </ul>
              </>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmPurge(false)}
                disabled={busy}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
              >
                انصراف
              </button>
              {purgeCount > 0 && (
                <button
                  type="button"
                  onClick={confirmPurgeAction}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-red-500/85 py-2.5 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-50"
                >
                  {busy ? "در حال حذف..." : `حذف ${formatNumber(purgeCount)} مورد`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
