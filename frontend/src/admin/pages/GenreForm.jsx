import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowRight, Loader2, Save } from "lucide-react"
import { genresApi, getApiError, getFieldErrors } from "../services/adminApi"
import { ErrorBox, Field, PrimaryBtn, Spinner, Toggle, cardCls, inputCls } from "../components/ui"

const slugify = (s) => String(s).trim().toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]+/g, "").replace(/-+/g, "-")

export default function GenreForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: "", slug: "", description: "", tmdb_id: "", is_active: true })
  const [slugTouched, setSlugTouched] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    if (!isEdit) return
    let alive = true
    genresApi.get(id)
      .then((d) => {
        if (!alive) return
        setForm({ name: d.name || "", slug: d.slug || "", description: d.description || "", tmdb_id: d.tmdb_id ?? "", is_active: d.is_active !== false })
        setSlugTouched(true)
      })
      .catch(() => { if (alive) setError("بارگذاری ژانر با خطا مواجه شد.") })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id, isEdit])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError(""); setFieldErrors({})
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
        description: form.description,
        tmdb_id: form.tmdb_id === "" ? null : Number(form.tmdb_id),
        is_active: form.is_active,
      }
      if (isEdit) await genresApi.update(id, payload); else await genresApi.create(payload)
      navigate("/admin/genres")
    } catch (err) {
      setFieldErrors(getFieldErrors(err))
      setError(getApiError(err, "ذخیره‌ی ژانر با خطا مواجه شد."))
    } finally { setSaving(false) }
  }

  if (loading) return <Spinner />

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-bold text-zinc-50 sm:text-2xl">{isEdit ? "ویرایش ژانر" : "افزودن ژانر"}</h1>
        <Link to="/admin/genres" className="ms-auto inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/10">
          <ArrowRight className="h-4 w-4" /> بازگشت
        </Link>
      </div>
      <ErrorBox message={error} />
      <section className={`${cardCls} space-y-4 p-5`}>
        <Field label="نام ژانر *" error={fieldErrors.name}>
          <input value={form.name} onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, name: v, slug: slugTouched ? f.slug : slugify(v) })) }} className={inputCls} required />
        </Field>
        <Field label="اسلاگ" error={fieldErrors.slug}>
          <input value={form.slug} onChange={(e) => { setSlugTouched(true); setForm((f) => ({ ...f, slug: e.target.value })) }} className={inputCls} dir="ltr" />
        </Field>
        <Field label="TMDB ID" error={fieldErrors.tmdb_id}>
          <input type="number" value={form.tmdb_id} onChange={(e) => setForm((f) => ({ ...f, tmdb_id: e.target.value }))} className={inputCls} dir="ltr" />
        </Field>
        <Field label="توضیحات" error={fieldErrors.description}>
          <textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={`${inputCls} resize-y`} />
        </Field>
        <Toggle label="فعال" desc="در سایت نمایش داده شود" checked={form.is_active} onChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
      </section>
      <div className="mt-6 flex justify-end">
        <PrimaryBtn type="submit" disabled={saving} className="!px-8">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} ذخیره
        </PrimaryBtn>
      </div>
    </form>
  )
}
