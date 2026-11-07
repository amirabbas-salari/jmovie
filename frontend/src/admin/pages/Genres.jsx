import { useState } from "react"
import { Link } from "react-router-dom"
import { Pencil, Trash2 } from "lucide-react"
import { genresApi } from "../services/adminApi"
import { useAdmin } from "../context/AdminContext"
import { P } from "../permissions"
import { Badge, ConfirmModal, EmptyState, ErrorBox, PageHeader, Pagination, SearchBox, Spinner, formatNumber, useAdminList } from "../components/ui"

export default function Genres() {
  const { can } = useAdmin()
  const list = useAdminList((params) => genresApi.list({ ...params, ordering: "name" }))
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await genresApi.remove(toDelete.id)
      list.setItems((p) => p.filter((g) => g.id !== toDelete.id))
      setToDelete(null)
    } finally { setDeleting(false) }
  }

  return (
    <div>
      <PageHeader title="ژانرها" subtitle="دسته‌بندی‌های فیلم و سریال" actionTo="/admin/genres/new" actionLabel="افزودن ژانر" actionPerm={P.genreAdd} can={can} />
      <div className="mb-5"><SearchBox value={list.search} onChange={list.setSearch} placeholder="جستجوی ژانر..." /></div>
      <ErrorBox message={list.error} />
      {list.loading ? <Spinner /> : list.items.length === 0 ? <EmptyState /> : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.items.map((g) => (
              <div key={g.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-red-500/25">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600/15 text-sm font-bold text-red-300">
                  {g.name?.[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-100">{g.name}</p>
                  <p className="truncate text-[11px] text-zinc-500" dir="ltr" style={{ textAlign: "right" }}>{g.slug}</p>
                  <p className="mt-1 flex gap-1.5">
                    <Badge>{formatNumber(g.movies_count)} فیلم</Badge>
                    <Badge>{formatNumber(g.series_count)} سریال</Badge>
                    {g.is_active === false && <Badge tone="red">غیرفعال</Badge>}
                  </p>
                </div>
                <span className="flex shrink-0 gap-1.5">
                  {can(P.genreChange) && (
                    <Link to={`/admin/genres/${g.id}/edit`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10" aria-label={`ویرایش ${g.name}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                  )}
                  {can(P.genreDelete) && (
                    <button onClick={() => setToDelete(g)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20" aria-label={`حذف ${g.name}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
          <Pagination page={list.page} total={list.total} pageSize={list.pageSize} onChange={list.setPage} />
        </>
      )}
      {toDelete && (
        <ConfirmModal title="حذف ژانر" message={`ژانر «${toDelete.name}» حذف شود؟ از فیلم‌ها و سریال‌های مرتبط هم برداشته می‌شود.`} loading={deleting} onCancel={() => setToDelete(null)} onConfirm={confirmDelete} />
      )}
    </div>
  )
}
