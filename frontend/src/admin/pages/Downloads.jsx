import { useEffect, useState } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { downloadsApi, episodesApi, moviesApi, seriesApi } from "../services/adminApi"
import { useAdmin } from "../context/AdminContext"
import { P } from "../permissions"
import { Badge, ConfirmModal, EmptyState, ErrorBox, Field, Modal, Pagination, PrimaryBtn, SearchBox, Spinner, GhostBtn, inputCls, useAdminList, useDebounced } from "../components/ui"
import { Loader2 } from "lucide-react"

const TYPE_LABELS = { movie: "فیلم", series: "سریال", episode: "قسمت" }
const emptyForm = { target_type: "movie", object_id: "", title: "", quality: "1080p", language: "زیرنویس چسبیده", subtitle: false, size: "", url: "", is_vip: false, is_active: true }

export default function Downloads() {
  const { can } = useAdmin()
  const [typeFilter, setTypeFilter] = useState("")
  const list = useAdminList(
    (params) => downloadsApi.list({ ...params, ...(typeFilter ? { target_type: typeFilter } : {}) }),
    [typeFilter]
  )
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const payload = { ...form, content_type: form.target_type, object_id: Number(form.object_id) }
      if (form.id) await downloadsApi.update(form.id, payload)
      else await downloadsApi.create(payload)
      setForm(null)
      list.reload()
    } finally { setSaving(false) }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await downloadsApi.remove(toDelete.id)
      list.setItems((p) => p.filter((d) => d.id !== toDelete.id))
      setToDelete(null)
    } finally { setDeleting(false) }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-50 sm:text-2xl">لینک‌های دانلود</h1>
          <p className="mt-1 text-sm text-zinc-500">همه‌ی لینک‌های فیلم، سریال و قسمت‌ها در یک جا</p>
        </div>
        {can(P.downloadAdd) && (
          <span className="ms-auto">
            <PrimaryBtn onClick={() => setForm({ ...emptyForm })}>افزودن لینک</PrimaryBtn>
          </span>
        )}
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <SearchBox value={list.search} onChange={list.setSearch} placeholder="جستجو در لینک‌ها (کیفیت، زبان، آدرس)..." />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-36 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-red-500/40">
          <option value="">همه هدف‌ها</option>
          <option value="movie">فیلم‌ها</option>
          <option value="series">سریال‌ها</option>
          <option value="episode">قسمت‌ها</option>
        </select>
      </div>

      <ErrorBox message={list.error} />
      {list.loading ? <Spinner /> : list.items.length === 0 ? <EmptyState text="لینکی یافت نشد." /> : (
        <>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.04] text-xs text-zinc-400">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">هدف</th>
                  <th className="px-4 py-3 text-right font-medium">کیفیت</th>
                  <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">زبان / حجم</th>
                  <th className="hidden px-4 py-3 text-right font-medium md:table-cell">وضعیت</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {list.items.map((d) => (
                  <tr key={d.id} className="bg-white/[0.02] hover:bg-white/[0.04]">
                    <td className="max-w-[240px] px-4 py-3">
                      <span className="block truncate font-medium text-zinc-100">{d.target_title}</span>
                      <span className="text-[11px] text-zinc-500">{TYPE_LABELS[d.target_type] || d.target_type}</span>
                    </td>
                    <td className="px-4 py-3"><Badge tone="red">{d.quality}</Badge></td>
                    <td className="hidden px-4 py-3 text-zinc-400 lg:table-cell">{d.language} {d.size && `• ${d.size}`}</td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <span className="flex gap-1">
                        {d.is_vip && <Badge tone="amber">VIP</Badge>}
                        {d.subtitle && <Badge>زیرنویس</Badge>}
                        {!d.is_active && <Badge tone="red">غیرفعال</Badge>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex justify-end gap-1.5">
                        {can(P.downloadChange) && (
                          <button onClick={() => setForm({ ...emptyForm, ...d, target_type: d.target_type })} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10" aria-label="ویرایش لینک">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {can(P.downloadDelete) && (
                          <button onClick={() => setToDelete(d)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20" aria-label="حذف لینک">
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

      {form && (
        <Modal title={form.id ? "ویرایش لینک دانلود" : "افزودن لینک دانلود"} onClose={() => setForm(null)} wide>
          <DownloadForm form={form} setForm={setForm} onSave={save} saving={saving} onCancel={() => setForm(null)} />
        </Modal>
      )}
      {toDelete && (
        <ConfirmModal title="حذف لینک" message={`لینک «${toDelete.quality}» برای «${toDelete.target_title}» حذف شود؟`} loading={deleting} onCancel={() => setToDelete(null)} onConfirm={confirmDelete} />
      )}
    </div>
  )
}

function DownloadForm({ form, setForm, onSave, saving, onCancel }) {
  const [targetQuery, setTargetQuery] = useState("")
  const [targets, setTargets] = useState([])
  const debounced = useDebounced(targetQuery, 350)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }))

  useEffect(() => {
    if (!debounced.trim()) { setTargets([]); return }
    let alive = true
    const api = { movie: moviesApi, series: seriesApi, episode: episodesApi }[form.target_type]
    api.list({ search: debounced, page_size: 8 }).then((d) => { if (alive) setTargets(d.items) }).catch(() => {})
    return () => { alive = false }
  }, [debounced, form.target_type])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="نوع هدف">
          <select value={form.target_type} onChange={(e) => { setForm((f) => ({ ...f, target_type: e.target.value, object_id: "" })); setTargets([]) }} className={inputCls}>
            <option value="movie">فیلم</option>
            <option value="series">سریال</option>
            <option value="episode">قسمت</option>
          </select>
        </Field>
        <Field label="جستجوی هدف">
          <input value={targetQuery} onChange={(e) => setTargetQuery(e.target.value)} placeholder="نام فیلم/سریال/قسمت..." className={inputCls} />
        </Field>
      </div>
      {targets.length > 0 && (
        <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
          {targets.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => { setForm((f) => ({ ...f, object_id: t.id })); setTargetQuery(t.title || `قسمت ${t.episode_number}`) }}
                className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-right text-sm transition ${Number(form.object_id) === t.id ? "bg-red-600/15 text-red-200" : "text-zinc-300 hover:bg-white/5"}`}>
                {t.title || `قسمت ${t.episode_number} — ${t.series_title || ""}`}
                {Number(form.object_id) === t.id && <span className="ms-auto text-xs text-red-300">انتخاب شد ✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field label="کیفیت"><input value={form.quality} onChange={set("quality")} className={inputCls} /></Field>
        <Field label="عنوان نمایشی"><input value={form.title} onChange={set("title")} className={inputCls} /></Field>
        <Field label="زبان"><input value={form.language} onChange={set("language")} className={inputCls} /></Field>
        <Field label="حجم"><input value={form.size} onChange={set("size")} className={inputCls} placeholder="1.4 GB" /></Field>
      </div>
      <Field label="لینک دانلود *"><input value={form.url} dir="ltr" onChange={set("url")} className={inputCls} placeholder="https://..." /></Field>
      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={form.subtitle} onChange={set("subtitle")} className="h-4 w-4 accent-red-600" /> زیرنویس دارد</label>
        <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={form.is_vip} onChange={set("is_vip")} className="h-4 w-4 accent-red-600" /> فقط VIP</label>
        <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={form.is_active} onChange={set("is_active")} className="h-4 w-4 accent-red-600" /> فعال</label>
      </div>
      <div className="flex gap-2 pt-1">
        <PrimaryBtn onClick={onSave} disabled={saving || !form.object_id || !form.url}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} ذخیره
        </PrimaryBtn>
        <GhostBtn onClick={onCancel}>انصراف</GhostBtn>
      </div>
    </div>
  )
}
