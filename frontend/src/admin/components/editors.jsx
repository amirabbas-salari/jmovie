import { useEffect, useRef, useState } from "react"
import { Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react"
import { downloadsApi, peopleApi } from "../services/adminApi"
import { useAdmin } from "../context/AdminContext"
import { P } from "../permissions"
import { Badge, ConfirmModal, Field, GhostBtn, PrimaryBtn, inputCls, useDebounced } from "./ui"

// ---------------------------------------------------------------------------
// انتخاب بازیگر/عامل با جستجوی زنده
// ---------------------------------------------------------------------------
export function PeoplePicker({ value, onChange, placeholder = "جستجوی نام فرد..." }) {
  const [query, setQuery] = useState(value?.name || "")
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const debounced = useDebounced(query, 350)
  const boxRef = useRef(null)

  useEffect(() => { setQuery(value?.name || "") }, [value])
  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  useEffect(() => {
    if (!open || !debounced.trim()) { setResults([]); return }
    let alive = true
    setSearching(true)
    peopleApi.list({ search: debounced, page_size: 8 })
      .then((d) => { if (alive) setResults(d.items) })
      .catch(() => {})
      .finally(() => { if (alive) setSearching(false) })
    return () => { alive = false }
  }, [debounced, open])

  return (
    <div className="relative" ref={boxRef}>
      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <input
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(null) }}
        placeholder={placeholder}
        className={`${inputCls} pr-9`}
      />
      {value && (
        <button type="button" onClick={() => { onChange(null); setQuery("") }} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300" aria-label="حذف انتخاب">
          <X className="h-4 w-4" />
        </button>
      )}
      {open && (searching || results.length > 0) && (
        <div className="absolute right-0 top-full z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-white/10 bg-zinc-900 shadow-2xl">
          {searching && <p className="flex items-center gap-2 px-3 py-2.5 text-xs text-zinc-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> در حال جستجو...</p>}
          {results.map((p) => (
            <button
              key={p.id} type="button"
              onClick={() => { onChange(p); setQuery(p.name); setOpen(false) }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-right text-sm text-zinc-300 transition hover:bg-white/5"
            >
              {p.display_image
                ? <img src={p.display_image} alt="" className="h-8 w-8 rounded-full object-cover" />
                : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-xs">{p.name?.[0]}</span>}
              <span className="flex-1">{p.name}</span>
              <span className="text-[11px] text-zinc-600" dir="ltr">{p.tmdb_id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ویرایشگر عوامل (بازیگر/کارگردان/نویسنده)
// ---------------------------------------------------------------------------
const ROLES = [
  { value: "actor", label: "بازیگر" },
  { value: "director", label: "کارگردان" },
  { value: "writer", label: "نویسنده" },
]

export function CastEditor({ items, onChange }) {
  const update = (idx, patch) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-[1fr_130px_1fr_auto]">
          <PeoplePicker value={item.person} onChange={(p) => update(idx, { person: p })} />
          <select value={item.role} onChange={(e) => update(idx, { role: e.target.value })} className={inputCls}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <input
            value={item.character_name || ""}
            onChange={(e) => update(idx, { character_name: e.target.value })}
            placeholder="نام نقش (برای بازیگر)"
            className={inputCls}
          />
          <button type="button" onClick={() => onChange(items.filter((_, i) => i !== idx))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 transition hover:bg-red-500/20" aria-label="حذف عامل">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <GhostBtn type="button" onClick={() => onChange([...items, { person: null, role: "actor", character_name: "" }])}>
        <Plus className="h-4 w-4" /> افزودن عامل
      </GhostBtn>
      <p className="text-[11px] text-zinc-600">فرد موردنظر در لیست نیست؟ اول از بخش «افراد و بازیگران» او را بسازید.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ویرایشگر گالری (لینک تصویر + کپشن + ترتیب)
// ---------------------------------------------------------------------------
export function GalleryEditor({ items, onChange }) {
  const update = (idx, patch) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          {item.image_url
            ? <img src={item.image_url} alt="" className="h-16 w-24 shrink-0 rounded-lg object-cover" />
            : <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg bg-white/5 text-[10px] text-zinc-600">بدون تصویر</span>}
          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_80px]">
            <input value={item.image_url || ""} dir="ltr" onChange={(e) => update(idx, { image_url: e.target.value })} placeholder="https://.../image.jpg" className={inputCls} />
            <input value={item.caption || ""} onChange={(e) => update(idx, { caption: e.target.value })} placeholder="توضیح تصویر" className={inputCls} />
            <input type="number" value={item.order ?? 0} onChange={(e) => update(idx, { order: Number(e.target.value) })} placeholder="ترتیب" className={inputCls} />
          </div>
          <button type="button" onClick={() => onChange(items.filter((_, i) => i !== idx))}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 transition hover:bg-red-500/20" aria-label="حذف تصویر">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <GhostBtn type="button" onClick={() => onChange([...items, { image_url: "", caption: "", order: items.length }])}>
        <Plus className="h-4 w-4" /> افزودن تصویر گالری
      </GhostBtn>
    </div>
  )
}

// ---------------------------------------------------------------------------
// مدیر لینک‌های دانلود یک هدف (فیلم/سریال/قسمت) — در فرم‌ها و صفحه‌ی دانلود
// ---------------------------------------------------------------------------
const emptyDownload = { title: "", quality: "1080p", language: "زیرنویس چسبیده", subtitle: false, size: "", url: "", is_vip: false, is_active: true }

export function DownloadsManager({ targetType, objectId }) {
  const { can } = useAdmin()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null) // null=بسته، {}=جدید، {id}=ویرایش
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = () => {
    if (!objectId) return
    setLoading(true)
    downloadsApi.list({ target_type: targetType, object_id: objectId, page_size: 100 })
      .then((d) => setItems(d.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(load, [targetType, objectId])

  if (!objectId) return <p className="text-sm text-zinc-500">برای مدیریت لینک‌های دانلود، اول اطلاعات اصلی را ذخیره کنید.</p>
  if (loading) return <p className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> در حال بارگذاری لینک‌ها...</p>

  const save = async () => {
    setSaving(true)
    try {
      const payload = { ...form, content_type: targetType, object_id: Number(objectId) }
      if (form.id) await downloadsApi.update(form.id, payload)
      else await downloadsApi.create(payload)
      setForm(null)
      load()
    } catch { /* خطا را ساده نگه می‌داریم؛ بک‌اند اعتبارسنجی می‌کند */ }
    finally { setSaving(false) }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try { await downloadsApi.remove(toDelete.id); setItems((p) => p.filter((d) => d.id !== toDelete.id)); setToDelete(null) }
    finally { setDeleting(false) }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }))

  return (
    <div className="space-y-3">
      {items.length === 0 && !form && <p className="text-sm text-zinc-500">هنوز لینک دانلودی ثبت نشده است.</p>}
      {items.map((d) => (
        <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-3">
          <Badge tone="red">{d.quality}</Badge>
          <span className="text-sm text-zinc-200">{d.title || d.language}</span>
          <span className="text-xs text-zinc-500">{d.size}</span>
          {d.subtitle && <Badge>زیرنویس</Badge>}
          {d.is_vip && <Badge tone="amber">VIP</Badge>}
          {!d.is_active && <Badge tone="red">غیرفعال</Badge>}
          <a href={d.url} target="_blank" rel="noreferrer" className="max-w-[220px] truncate text-[11px] text-zinc-500 hover:text-zinc-300" dir="ltr">{d.url}</a>
          <span className="ms-auto flex gap-1.5">
            {can(P.downloadChange) && (
              <button onClick={() => setForm({ ...emptyDownload, ...d })} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10" aria-label="ویرایش لینک">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {can(P.downloadDelete) && (
              <button onClick={() => setToDelete(d)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20" aria-label="حذف لینک">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        </div>
      ))}

      {form ? (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4 sm:grid-cols-2">
          <Field label="کیفیت"><input value={form.quality} onChange={set("quality")} className={inputCls} placeholder="1080p BluRay" /></Field>
          <Field label="عنوان نمایشی"><input value={form.title} onChange={set("title")} className={inputCls} /></Field>
          <Field label="زبان / نوع"><input value={form.language} onChange={set("language")} className={inputCls} /></Field>
          <Field label="حجم"><input value={form.size} onChange={set("size")} className={inputCls} placeholder="1.4 GB" /></Field>
          <div className="sm:col-span-2"><Field label="لینک دانلود"><input value={form.url} dir="ltr" onChange={set("url")} className={inputCls} placeholder="https://..." /></Field></div>
          <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={form.subtitle} onChange={set("subtitle")} className="h-4 w-4 accent-red-600" /> زیرنویس دارد</label>
          <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={form.is_vip} onChange={set("is_vip")} className="h-4 w-4 accent-red-600" /> فقط VIP</label>
          <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={form.is_active} onChange={set("is_active")} className="h-4 w-4 accent-red-600" /> فعال</label>
          <div className="flex gap-2 sm:col-span-2">
            <PrimaryBtn type="button" onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} ذخیره لینک</PrimaryBtn>
            <GhostBtn type="button" onClick={() => setForm(null)}>انصراف</GhostBtn>
          </div>
        </div>
      ) : (
        can(P.downloadAdd) && (
          <GhostBtn type="button" onClick={() => setForm({ ...emptyDownload })}>
            <Plus className="h-4 w-4" /> افزودن لینک دانلود
          </GhostBtn>
        )
      )}

      {toDelete && (
        <ConfirmModal title="حذف لینک دانلود" message={`لینک «${toDelete.quality} — ${toDelete.title || toDelete.language}» حذف شود؟`} loading={deleting} onCancel={() => setToDelete(null)} onConfirm={confirmDelete} />
      )}
    </div>
  )
}
