import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Pencil, ShieldCheck, Trash2 } from "lucide-react"
import { usersApi } from "../services/adminApi"
import { useAdmin } from "../context/AdminContext"
import { P } from "../permissions"
import { Badge, ConfirmModal, EmptyState, ErrorBox, PageHeader, Pagination, SearchBox, Spinner, useAdminList } from "../components/ui"

const ROLE_FILTERS = [
  { id: "", label: "همه" },
  { id: "staff", label: "ادمین‌ها" },
  { id: "superuser", label: "سوپرادمین‌ها" },
  { id: "vip", label: "VIP" },
  { id: "user", label: "کاربران عادی" },
]

export default function Users() {
  const { can, isSuperAdmin } = useAdmin()
  const [searchParams, setSearchParams] = useSearchParams()
  const role = searchParams.get("role") || ""
  const list = useAdminList(
    (params) => usersApi.list({ ...params, ...(role ? { role } : {}), ordering: "-date_joined" }),
    [role]
  )
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const toggleActive = async (user) => {
    setBusyId(user.id)
    try {
      const updated = await usersApi.toggleActive(user.id)
      list.setItems((p) => p.map((u) => (u.id === user.id ? updated : u)))
    } finally { setBusyId(null) }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await usersApi.remove(toDelete.id)
      list.setItems((p) => p.filter((u) => u.id !== toDelete.id))
      setToDelete(null)
    } finally { setDeleting(false) }
  }

  return (
    <div>
      <PageHeader title="کاربران" subtitle="مدیریت کاربران، ادمین‌ها و سطح دسترسی آن‌ها" actionTo="/admin/users/new" actionLabel="افزودن کاربر" actionPerm={P.userAdd} can={can} />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] p-1">
          {ROLE_FILTERS.map((f) => (
            <button key={f.id || "all"} onClick={() => setSearchParams(f.id ? { role: f.id } : {})}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-medium transition sm:text-sm ${role === f.id ? "bg-red-600 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="min-w-[200px] flex-1">
          <SearchBox value={list.search} onChange={list.setSearch} placeholder="جستجو: نام کاربری، ایمیل، نام..." />
        </div>
      </div>

      <ErrorBox message={list.error} />
      {list.loading ? <Spinner /> : list.items.length === 0 ? <EmptyState /> : (
        <>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.04] text-xs text-zinc-400">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">کاربر</th>
                  <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">نقش‌ها</th>
                  <th className="hidden px-4 py-3 text-right font-medium md:table-cell">عضویت</th>
                  <th className="px-4 py-3 text-right font-medium">وضعیت</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {list.items.map((u) => (
                  <tr key={u.id} className="bg-white/[0.02] hover:bg-white/[0.04]">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600/15 text-xs font-bold text-red-300">
                          {u.username?.[0]?.toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-zinc-100">
                            {u.username}
                            {(u.first_name || u.last_name) && <span className="text-zinc-500"> — {u.first_name} {u.last_name}</span>}
                          </span>
                          <span className="block truncate text-[11px] text-zinc-500" dir="ltr" style={{ textAlign: "right" }}>{u.email}</span>
                        </span>
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <span className="flex flex-wrap gap-1">
                        {u.is_superuser && <Badge tone="red"><ShieldCheck className="h-3 w-3" /> سوپرادمین</Badge>}
                        {!u.is_superuser && u.roles?.length > 0
                          ? u.roles.map((r) => <Badge key={r.id}>{r.name}</Badge>)
                          : u.is_staff && !u.is_superuser && <Badge tone="amber">ادمین بدون نقش</Badge>}
                        {u.is_vip && <Badge tone="amber">VIP</Badge>}
                        {!u.is_staff && !u.is_superuser && !u.is_vip && <Badge>کاربر عادی</Badge>}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-zinc-500 md:table-cell">
                      {u.date_joined ? new Date(u.date_joined).toLocaleDateString("fa-IR") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {can(P.userChange) ? (
                        <button disabled={busyId === u.id} onClick={() => toggleActive(u)}
                          className={`relative h-6 w-11 rounded-full transition disabled:opacity-50 ${u.is_active ? "bg-emerald-600" : "bg-zinc-700"}`}
                          title={u.is_active ? "فعال — برای غیرفعال‌کردن کلیک کنید" : "غیرفعال — برای فعال‌کردن کلیک کنید"}>
                          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${u.is_active ? "right-[22px]" : "right-0.5"}`} />
                        </button>
                      ) : (
                        <Badge tone={u.is_active ? "green" : "red"}>{u.is_active ? "فعال" : "غیرفعال"}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex justify-end gap-1.5">
                        {can(P.userChange) && (
                          <Link to={`/admin/users/${u.id}/edit`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10" aria-label={`ویرایش ${u.username}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        )}
                        {can(P.userDelete) && (
                          <button onClick={() => setToDelete(u)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20" aria-label={`حذف ${u.username}`}>
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

      {isSuperAdmin && (
        <p className="mt-4 text-xs leading-6 text-zinc-600">
          💡 برای دادن دسترسی پنل به یک همکار: او را ویرایش کنید، «دسترسی به پنل (Staff)» را فعال و نقشش را انتخاب کنید.
          ساخت نقش جدید و تعیین مجوزهای هر نقش از بخش «نقش‌ها و دسترسی‌ها» انجام می‌شود.
        </p>
      )}

      {toDelete && (
        <ConfirmModal title="حذف کاربر" message={`کاربر «${toDelete.username}» به‌همراه نظرات و لیست‌هایش حذف شود؟`} loading={deleting} onCancel={() => setToDelete(null)} onConfirm={confirmDelete} />
      )}
    </div>
  )
}
