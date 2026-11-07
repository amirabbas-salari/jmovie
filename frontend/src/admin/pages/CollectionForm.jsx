import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowRight, Loader2, Plus, Save, Search, Trash2, X } from "lucide-react"
import { collectionItemsApi, collectionsApi, moviesApi, seriesApi, getApiError, getFieldErrors } from "../services/adminApi"
import { ErrorBox, Field, PrimaryBtn, Spinner, Toggle, cardCls, inputCls, useDebounced } from "../components/ui"

const emptyForm = { title: "", slug: "", description: "", tmdb_id: "", poster_url: "", backdrop_url: "", order: 0, is_active: true }

export default function CollectionForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [posterFile, setPosterFile] = useState(null)
  const [backdropFile, setBackdropFile] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    if (!isEdit) return
    let alive = true
    collectionsApi.get(id)
      .then((d) => {
        if (!alive) return
        setForm({
          title: d.title || "", slug: d.slug || "", description: d.description || "",
          tmdb_id: d.tmdb_id ?? "", poster_url: d.poster_url || "", backdrop_url: d.backdrop_url || "",
          order: d.order ?? 0, is_active: d.is_active !== false,
        })
        setItems(d.items || [])
      })
      .catch(() => { if (alive) setError("بارگذاری کالکشن با خطا مواجه شد.") })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id, isEdit])

  const set = (n) => (e) => { setForm((f) => ({ ...f, [n]: e.target.value })); setFieldErrors((p) => ({ ...p, [n]: undefined })) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError(""); setFieldErrors({})
    try {
      const payload = { ...form, tmdb_id: form.tmdb_id === "" ? null : Number(form.tmdb_id), order: Number(form.order) || 0 }
      if (posterFile || backdropFile) {
        const fd = new FormData()
        Object.entries(payload).forEach(([k, v]) => { if (v !== null && v !== "") fd.append(k, v) })
        if (posterFile) fd.append("poster", posterFile)
        if (backdropFile) fd.append("backdrop", backdropFile)
        if (isEdit) await collectionsApi.update(id, fd); else await collectionsApi.create(fd)
      } else if (isEdit) await collectionsApi.update(id, payload)
      else await collectionsApi.create(payload)
      navigate("/admin/collections")
    } catch (err) {
      setFieldErrors(getFieldErrors(err))
      setError(getApiError(err, "ذخیره‌ی کالکشن با خطا مواجه شد."))
    } finally { setSaving(false) }
  }

  const addItem = async (targetType, target) => {
    const created = await collectionItemsApi.create({
      collection: Number(id), content_type: targetType, object_id: target.id, order: items.length,
    })
    setItems((p) => [...p, created])
  }
  const removeItem = async (item) => {
    await collectionItemsApi.remove(item.id)
    setItems((p) => p.filter((i) => i.id !== item.id))
  }
  const changeOrder = async (item, order) => {
    const updated = await collectionItemsApi.update(item.id, { order: Number(order) || 0 })
    setItems((p) => p.map((i) => (i.id === item.id ? updated : i)).sort((a, b) => a.order - b.order))
  }

  if (loading) return <Spinner />
  const posterPreview = posterFile ? URL.createObjectURL(posterFile) : form.poster_url

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-50 sm:text-2xl">{isEdit ? "ویرایش کالکشن" : "افزودن کالکشن"}</h1>
          <p className="mt-1 text-sm text-zinc-500">اطلاعات کالکشن و آیتم‌های داخلش</p>
        </div>
        <Link to="/admin/collections" className="ms-auto inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/10">
          <ArrowRight className="h-4 w-4" /> بازگشت
        </Link>
      </div>
      <ErrorBox message={error} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className={`${cardCls} space-y-4 p-5 lg:col-span-2`}>
          <Field label="عنوان *" error={fieldErrors.title}><input value={form.title} onChange={set("title")} className={inputCls} required /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="اسلاگ" error={fieldErrors.slug} hint="خالی بماند خودکار ساخته می‌شود"><input value={form.slug} onChange={set("slug")} className={inputCls} dir="ltr" /></Field>
            <Field label="TMDB ID" error={fieldErrors.tmdb_id}><input type="number" value={form.tmdb_id} onChange={set("tmdb_id")} className={inputCls} dir="ltr" /></Field>
            <Field label="ترتیب نمایش" error={fieldErrors.order}><input type="number" value={form.order} onChange={set("order")} className={inputCls} /></Field>
            <div className="flex items-end pb-1">
              <Toggle label="فعال" desc="در سایت نمایش داده شود" checked={form.is_active} onChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
            </div>
          </div>
          <Field label="توضیحات" error={fieldErrors.description}>
            <textarea rows={4} value={form.description} onChange={set("description")} className={`${inputCls} resize-y`} />
          </Field>
        </section>

        <section className={`${cardCls} space-y-4 p-5`}>
          <h2 className="font-bold text-zinc-100">تصاویر</h2>
          <div>
            <p className="mb-2 text-xs text-zinc-400">پوستر</p>
            {posterPreview && <img src={posterPreview} alt="" className="mb-2 aspect-video w-full rounded-xl object-cover" />}
            <input type="file" accept="image/*" onChange={(e) => setPosterFile(e.target.files?.[0] || null)} className="mb-2 block w-full text-xs text-zinc-400 file:ml-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-zinc-200" />
            <input value={form.poster_url} onChange={set("poster_url")} placeholder="یا لینک پوستر" dir="ltr" className={inputCls} />
          </div>
          <div>
            <p className="mb-2 text-xs text-zinc-400">بک‌گراند</p>
            <input type="file" accept="image/*" onChange={(e) => setBackdropFile(e.target.files?.[0] || null)} className="mb-2 block w-full text-xs text-zinc-400 file:ml-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-zinc-200" />
            <input value={form.backdrop_url} onChange={set("backdrop_url")} placeholder="یا لینک بک‌گراند" dir="ltr" className={inputCls} />
          </div>
        </section>
      </div>

      {isEdit && (
        <section className={`${cardCls} mt-5 p-5`}>
          <h2 className="mb-4 font-bold text-zinc-100">آیتم‌های کالکشن ({items.length})</h2>
          <MediaSearch onAdd={addItem} existing={items} />
          <ul className="mt-4 space-y-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5">
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${item.target_type === "movie" ? "bg-red-500/15 text-red-300" : "bg-sky-500/15 text-sky-300"}`}>
                  {item.target_type === "movie" ? "فیلم" : "سریال"}
                </span>
                <span className="flex-1 truncate text-sm text-zinc-200">{item.target_title}</span>
                <input type="number" defaultValue={item.order} onBlur={(e) => changeOrder(item, e.target.value)} className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs outline-none focus:border-red-500/40" aria-label="ترتیب" />
                <button type="button" onClick={() => removeItem(item)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20" aria-label="حذف از کالکشن">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
            {items.length === 0 && <li className="py-4 text-center text-sm text-zinc-500">هنوز آیتمی اضافه نشده است.</li>}
          </ul>
        </section>
      )}

      <div className="sticky bottom-4 mt-6 flex justify-end">
        <PrimaryBtn type="submit" disabled={saving} className="!px-8 !py-3">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} ذخیره کالکشن
        </PrimaryBtn>
      </div>
    </form>
  )
}

function MediaSearch({ onAdd, existing }) {
  const [type, setType] = useState("movie")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const debounced = useDebounced(query, 350)

  useEffect(() => {
    if (!debounced.trim()) { setResults([]); return }
    let alive = true
    const api = type === "movie" ? moviesApi : seriesApi
    api.list({ search: debounced, page_size: 8 }).then((d) => { if (alive) setResults(d.items) }).catch(() => {})
    return () => { alive = false }
  }, [debounced, type])

  return (
    <div>
      <div className="flex gap-2">
        <select value={type} onChange={(e) => setType(e.target.value)} className="w-28 shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-red-500/40">
          <option value="movie">فیلم</option>
          <option value="series">سریال</option>
        </select>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجو برای افزودن به کالکشن..." className={`${inputCls} pr-9`} />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" aria-label="پاک کردن">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
          {results.map((r) => {
            const already = existing.some((i) => i.target_type === type && Number(i.object_id) === r.id)
            return (
              <li key={r.id} className="flex items-center gap-3 bg-white/[0.02] px-3.5 py-2.5">
                <span className="flex-1 truncate text-sm text-zinc-200">{r.title} <span className="text-[11px] text-zinc-500">{r.year || r.start_date?.slice(0, 4) || ""}</span></span>
                <button type="button" disabled={already} onClick={() => onAdd(type, r)} className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700">
                  <Plus className="h-3.5 w-3.5" /> {already ? "اضافه شده" : "افزودن"}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
