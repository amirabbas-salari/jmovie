import { useState } from "react"
import { Link } from "react-router-dom"
import { Pencil, Trash2 } from "lucide-react"
import { peopleApi } from "../services/adminApi"
import { useAdmin } from "../context/AdminContext"
import { P } from "../permissions"
import { ConfirmModal, EmptyState, ErrorBox, PageHeader, Pagination, SearchBox, Spinner, useAdminList } from "../components/ui"

export default function People() {
  const { can } = useAdmin()
  const list = useAdminList((params) => peopleApi.list({ ...params, ordering: "-popularity" }))
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await peopleApi.remove(toDelete.id)
      list.setItems((p) => p.filter((x) => x.id !== toDelete.id))
      setToDelete(null)
    } finally { setDeleting(false) }
  }

  return (
    <div>
      <PageHeader title="افراد و بازیگران" subtitle="بازیگران، کارگردانان و نویسندگان" actionTo="/admin/people/new" actionLabel="افزودن فرد" actionPerm={P.personAdd} can={can} />
      <div className="mb-5"><SearchBox value={list.search} onChange={list.setSearch} placeholder="جستجوی نام یا TMDB ID..." /></div>
      <ErrorBox message={list.error} />
      {list.loading ? <Spinner /> : list.items.length === 0 ? <EmptyState /> : (
        <>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.04] text-xs text-zinc-400">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">فرد</th>
                  <th className="px-4 py-3 text-right font-medium">TMDB ID</th>
                  <th className="hidden px-4 py-3 text-right font-medium md:table-cell">تولد</th>
                  <th className="hidden px-4 py-3 text-right font-medium md:table-cell">محبوبیت</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {list.items.map((p) => (
                  <tr key={p.id} className="bg-white/[0.02] transition hover:bg-white/[0.04]">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-3">
                        {p.display_image
                          ? <img src={p.display_image} alt="" loading="lazy" className="h-10 w-10 rounded-full object-cover" />
                          : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-xs text-zinc-400">{p.name?.[0]}</span>}
                        <span>
                          <span className="block font-medium text-zinc-100">{p.name}</span>
                          <span className="text-[11px] text-zinc-500" dir="ltr">{p.original_name || p.slug}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400" dir="ltr" style={{ textAlign: "right" }}>{p.tmdb_id}</td>
                    <td className="hidden px-4 py-3 text-zinc-400 md:table-cell">{p.birth_date || "—"}</td>
                    <td className="hidden px-4 py-3 text-zinc-400 md:table-cell">{p.popularity ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="flex justify-end gap-1.5">
                        {can(P.personChange) && (
                          <Link to={`/admin/people/${p.id}/edit`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10" aria-label={`ویرایش ${p.name}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        )}
                        {can(P.personDelete) && (
                          <button onClick={() => setToDelete(p)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20" aria-label={`حذف ${p.name}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={list.page} total={list.total} pageSize={list.pageSize} onChange={list.setPage} />
        </>
      )}
      {toDelete && (
        <ConfirmModal title="حذف فرد" message={`«${toDelete.name}» حذف شود؟ سوابق او در عوامل فیلم‌ها و سریال‌ها هم حذف می‌شود.`} loading={deleting} onCancel={() => setToDelete(null)} onConfirm={confirmDelete} />
      )}
    </div>
  )
}
