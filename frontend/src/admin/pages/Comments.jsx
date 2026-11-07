import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Check, Trash2, X } from "lucide-react"
import { commentsApi } from "../services/adminApi"
import { useAdmin } from "../context/AdminContext"
import { P } from "../permissions"
import { Badge, ConfirmModal, EmptyState, ErrorBox, Pagination, SearchBox, Spinner, useAdminList } from "../components/ui"

const TABS = [
  { id: "pending", label: "در انتظار تأیید" },
  { id: "approved", label: "تأییدشده" },
  { id: "inactive", label: "ردشده / غیرفعال" },
  { id: "", label: "همه" },
]
const TYPE_LABELS = { movie: "فیلم", series: "سریال", episode: "قسمت" }

export default function Comments() {
  const { can } = useAdmin()
  const [searchParams, setSearchParams] = useSearchParams()
  const statusTab = searchParams.get("status") || "pending"
  const list = useAdminList(
    (params) => commentsApi.list({ ...params, ...(statusTab ? { status: statusTab } : {}) }),
    [statusTab]
  )
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    if (!searchParams.get("status")) setSearchParams({ status: "pending" }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const moderate = async (comment, approve) => {
    setBusyId(comment.id)
    try {
      const updated = approve ? await commentsApi.approve(comment.id) : await commentsApi.reject(comment.id)
      if (statusTab) list.setItems((p) => p.filter((c) => c.id !== comment.id))
      else list.setItems((p) => p.map((c) => (c.id === comment.id ? updated : c)))
    } finally { setBusyId(null) }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await commentsApi.remove(toDelete.id)
      list.setItems((p) => p.filter((c) => c.id !== toDelete.id))
      setToDelete(null)
    } finally { setDeleting(false) }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-50 sm:text-2xl">نظرات کاربران</h1>
        <p className="mt-1 text-sm text-zinc-500">نظارت و تأیید نظرات فیلم، سریال و قسمت‌ها</p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
          {TABS.map((t) => (
            <button key={t.id || "all"} onClick={() => setSearchParams(t.id ? { status: t.id } : {})}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-medium transition sm:text-sm ${statusTab === t.id ? "bg-red-600 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="min-w-[200px] flex-1">
          <SearchBox value={list.search} onChange={list.setSearch} placeholder="جستجو در متن نظر یا نام کاربر..." />
        </div>
      </div>

      <ErrorBox message={list.error} />
      {list.loading ? <Spinner /> : list.items.length === 0 ? <EmptyState text="نظری در این وضعیت نیست." /> : (
        <>
          <ul className="space-y-3">
            {list.items.map((c) => (
              <li key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span className="font-medium text-zinc-200">{c.username}</span>
                  <span>روی {TYPE_LABELS[c.target_type] || c.target_type} «{c.target_title}»</span>
                  <span className="ms-auto flex gap-1.5">
                    {c.is_approved ? <Badge tone="green">تأییدشده</Badge> : <Badge tone="amber">در انتظار</Badge>}
                    {!c.is_active && <Badge tone="red">غیرفعال</Badge>}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-7 text-zinc-100">{c.text}</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[11px] text-zinc-600">{new Date(c.created_at).toLocaleString("fa-IR")}</span>
                  <span className="ms-auto flex gap-2">
                    {can(P.commentChange) && !c.is_approved && (
                      <button disabled={busyId === c.id} onClick={() => moderate(c, true)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-600/30 disabled:opacity-50">
                        <Check className="h-3.5 w-3.5" /> تأیید و انتشار
                      </button>
                    )}
                    {can(P.commentChange) && c.is_active && (
                      <button disabled={busyId === c.id} onClick={() => moderate(c, false)} className="inline-flex items-center gap-1 rounded-lg bg-amber-600/20 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-600/30 disabled:opacity-50">
                        <X className="h-3.5 w-3.5" /> رد کردن
                      </button>
                    )}
                    {can(P.commentDelete) && (
                      <button onClick={() => setToDelete(c)} className="inline-flex items-center gap-1 rounded-lg bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-600/30">
                        <Trash2 className="h-3.5 w-3.5" /> حذف
                      </button>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={list.page} total={list.total} pageSize={list.pageSize} onChange={list.setPage} />
        </>
      )}

      {toDelete && (
        <ConfirmModal title="حذف نظر" message="این نظر و پاسخ‌هایش حذف شود؟" loading={deleting} onCancel={() => setToDelete(null)} onConfirm={confirmDelete} />
      )}
    </div>
  )
}
