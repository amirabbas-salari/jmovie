import { Link } from "react-router-dom"
import { ShieldCheck } from "lucide-react"
import { auditLogsApi } from "../services/adminApi"
import { useAdmin } from "../context/AdminContext"
import { PrimaryBtn, EmptyState, ErrorBox, Pagination, SearchBox, Spinner, useAdminList, Badge } from "../components/ui"

const ACTION_LABELS = { create: ["ساخت", "green"], update: ["ویرایش", "amber"], delete: ["حذف", "red"] }

export default function AuditLogs() {
  const { isSuperAdmin, loading: adminLoading } = useAdmin()

  if (adminLoading) return <Spinner />
  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-red-500" />
        <h1 className="text-lg font-bold text-zinc-100">فقط سوپرادمین</h1>
        <p className="mt-2 text-sm text-zinc-500">مشاهده‌ی لاگ فعالیت‌های پنل فقط برای سوپرادمین است.</p>
        <Link to="/admin" className="mt-5 inline-block"><PrimaryBtn>بازگشت به داشبورد</PrimaryBtn></Link>
      </div>
    )
  }
  return <AuditLogsTable />
}

function AuditLogsTable() {
  const list = useAdminList((params) => auditLogsApi.list({ ...params, ordering: "-created_at" }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-50 sm:text-2xl">لاگ فعالیت‌های پنل</h1>
        <p className="mt-1 text-sm text-zinc-500">چه کسی، چه چیزی را، کی تغییر داده است — برای پاسخ‌گویی و امنیت</p>
      </div>
      <div className="mb-5"><SearchBox value={list.search} onChange={list.setSearch} placeholder="جستجو: نام ادمین، مدل، عنوان..." /></div>
      <ErrorBox message={list.error} />
      {list.loading ? <Spinner /> : list.items.length === 0 ? <EmptyState text="هنوز فعالیتی ثبت نشده است." /> : (
        <>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.04] text-xs text-zinc-400">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">زمان</th>
                  <th className="px-4 py-3 text-right font-medium">ادمین</th>
                  <th className="px-4 py-3 text-right font-medium">عملیات</th>
                  <th className="px-4 py-3 text-right font-medium">مورد</th>
                  <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {list.items.map((log) => {
                  const [label, tone] = ACTION_LABELS[log.action] || [log.action, "zinc"]
                  return (
                    <tr key={log.id} className="bg-white/[0.02] hover:bg-white/[0.04]">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-400">{new Date(log.created_at).toLocaleString("fa-IR")}</td>
                      <td className="px-4 py-3 font-medium text-zinc-200">{log.username || "—"}</td>
                      <td className="px-4 py-3"><Badge tone={tone}>{label}</Badge></td>
                      <td className="max-w-[280px] px-4 py-3">
                        <span className="block truncate text-zinc-200">{log.object_repr}</span>
                        <span className="text-[11px] text-zinc-600" dir="ltr">{log.model_label}#{log.object_id}</span>
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-zinc-500 lg:table-cell" dir="ltr" style={{ textAlign: "right" }}>{log.ip_address || "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={list.page} total={list.total} pageSize={list.pageSize} onChange={list.setPage} />
        </>
      )}
    </div>
  )
}
