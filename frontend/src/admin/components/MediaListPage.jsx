import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Pencil, Star, Trash2 } from "lucide-react"
import { useAdmin } from "../context/AdminContext"
import {
  Badge, ConfirmModal, EmptyState, ErrorBox, PageHeader, Pagination,
  SearchBox, Spinner, formatNumber, thumbOf, useAdminList,
} from "./ui"

// لیست مشترک فیلم/سریال: جستجوی سمت سرور + صفحه‌بندی + حذف با تأیید
export default function MediaListPage({ title, subtitle, basePath, api, perms, kindLabel }) {
  const { can } = useAdmin()
  const [searchParams] = useSearchParams()
  const list = useAdminList((params) => api.list(params))
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // جستجوی تاپ‌بار (?search=) را به جستجوی لیست وصل می‌کند
  useEffect(() => {
    const q = searchParams.get("search")
    if (q) list.setSearch(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

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

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} actionTo={`${basePath}/new`} actionLabel={`افزودن ${kindLabel}`} actionPerm={perms.add} can={can} />

      <div className="mb-5 flex gap-3">
        <SearchBox value={list.search} onChange={list.setSearch} placeholder={`جستجوی ${kindLabel} (عنوان، IMDb ID)...`} />
      </div>

      <ErrorBox message={list.error} />
      {list.loading ? <Spinner /> : list.items.length === 0 ? <EmptyState /> : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {list.items.map((item) => {
              const thumb = thumbOf(item)
              return (
                <div key={item.id} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-red-500/30">
                  <div className="relative aspect-[2/3] bg-zinc-900">
                    {thumb
                      ? <img src={thumb} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
                      : <div className="flex h-full items-center justify-center text-xs text-zinc-600">بدون پوستر</div>}
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-amber-300 backdrop-blur">
                      <Star className="h-3 w-3 fill-amber-300" /> {item.imdb_rating || "—"}
                    </span>
                    {item.is_active === false && <span className="absolute left-2 top-2"><Badge tone="red">غیرفعال</Badge></span>}
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
                      {can(perms.delete) && (
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
    </div>
  )
}
