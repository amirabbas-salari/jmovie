import { useState } from "react"
import { Link } from "react-router-dom"
import { Pencil, Trash2 } from "lucide-react"
import { collectionsApi } from "../services/adminApi"
import { useAdmin } from "../context/AdminContext"
import { P } from "../permissions"
import { Badge, ConfirmModal, EmptyState, ErrorBox, PageHeader, Pagination, SearchBox, Spinner, formatNumber, useAdminList } from "../components/ui"

export default function Collections() {
  const { can } = useAdmin()
  const list = useAdminList((params) => collectionsApi.list({ ...params, ordering: "order" }))
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await collectionsApi.remove(toDelete.id)
      list.setItems((p) => p.filter((c) => c.id !== toDelete.id))
      setToDelete(null)
    } finally { setDeleting(false) }
  }

  return (
    <div>
      <PageHeader title="کالکشن‌ها" subtitle="مجموعه‌های منتخب فیلم و سریال (مثل «۲۵۰ فیلم برتر»)" actionTo="/admin/collections/new" actionLabel="افزودن کالکشن" actionPerm={P.collectionAdd} can={can} />
      <div className="mb-5"><SearchBox value={list.search} onChange={list.setSearch} placeholder="جستجوی کالکشن..." /></div>
      <ErrorBox message={list.error} />
      {list.loading ? <Spinner /> : list.items.length === 0 ? <EmptyState /> : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.items.map((c) => (
              <div key={c.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-red-500/25">
                <div className="relative aspect-[16/7] bg-zinc-900">
                  {c.poster_url || c.poster
                    ? <img src={c.poster_url || c.poster} alt="" loading="lazy" className="h-full w-full object-cover" />
                    : <div className="flex h-full items-center justify-center text-xs text-zinc-600">بدون تصویر</div>}
                  <span className="absolute right-2 top-2"><Badge>{formatNumber(c.items_count)} آیتم</Badge></span>
                  {c.is_active === false && <span className="absolute left-2 top-2"><Badge tone="red">غیرفعال</Badge></span>}
                </div>
                <div className="flex items-center gap-2 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-100">{c.title}</p>
                    <p className="truncate text-[11px] text-zinc-500" dir="ltr" style={{ textAlign: "right" }}>{c.slug} • ترتیب {c.order}</p>
                  </div>
                  {can(P.collectionChange) && (
                    <Link to={`/admin/collections/${c.id}/edit`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10" aria-label={`ویرایش ${c.title}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                  )}
                  {can(P.collectionDelete) && (
                    <button onClick={() => setToDelete(c)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20" aria-label={`حذف ${c.title}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Pagination page={list.page} total={list.total} pageSize={list.pageSize} onChange={list.setPage} />
        </>
      )}
      {toDelete && (
        <ConfirmModal title="حذف کالکشن" message={`کالکشن «${toDelete.title}» حذف شود؟ (فیلم‌ها و سریال‌های داخلش حذف نمی‌شوند)`} loading={deleting} onCancel={() => setToDelete(null)} onConfirm={confirmDelete} />
      )}
    </div>
  )
}
