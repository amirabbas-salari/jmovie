import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowRight, Loader2, Save } from "lucide-react"
import { peopleApi, getApiError, getFieldErrors } from "../services/adminApi"
import { ErrorBox, Field, PrimaryBtn, Spinner, cardCls, inputCls } from "../components/ui"

const emptyForm = {
  tmdb_id: "", name: "", original_name: "", slug: "", biography: "",
  birth_date: "", death_date: "", place_of_birth: "", profile_image_url: "", popularity: "",
}

export default function PersonForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [imageFile, setImageFile] = useState(null)
  const [currentImage, setCurrentImage] = useState("")
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    if (!isEdit) return
    let alive = true
    peopleApi.get(id)
      .then((d) => {
        if (!alive) return
        setForm({
          tmdb_id: d.tmdb_id || "", name: d.name || "", original_name: d.original_name || "",
          slug: d.slug || "", biography: d.biography || "", birth_date: d.birth_date || "",
          death_date: d.death_date || "", place_of_birth: d.place_of_birth || "",
          profile_image_url: d.profile_image_url || "", popularity: d.popularity ?? "",
        })
        setCurrentImage(d.display_image || "")
      })
      .catch(() => { if (alive) setError("بارگذاری اطلاعات فرد با خطا مواجه شد.") })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id, isEdit])

  const set = (n) => (e) => { setForm((f) => ({ ...f, [n]: e.target.value })); setFieldErrors((p) => ({ ...p, [n]: undefined })) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError(""); setFieldErrors({})
    try {
      const payload = {
        ...form,
        popularity: form.popularity === "" ? null : Number(form.popularity),
        birth_date: form.birth_date || null, death_date: form.death_date || null,
      }
      if (imageFile) {
        const fd = new FormData()
        Object.entries(payload).forEach(([k, v]) => { if (v !== null && v !== "") fd.append(k, v) })
        fd.append("profile_image", imageFile)
        if (isEdit) await peopleApi.update(id, fd); else await peopleApi.create(fd)
      } else if (isEdit) await peopleApi.update(id, payload)
      else await peopleApi.create(payload)
      navigate("/admin/people")
    } catch (err) {
      setFieldErrors(getFieldErrors(err))
      setError(getApiError(err, "ذخیره با خطا مواجه شد."))
    } finally { setSaving(false) }
  }

  if (loading) return <Spinner />
  const preview = imageFile ? URL.createObjectURL(imageFile) : form.profile_image_url || currentImage

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-50 sm:text-2xl">{isEdit ? "ویرایش فرد" : "افزودن فرد جدید"}</h1>
          <p className="mt-1 text-sm text-zinc-500">بازیگر، کارگردان یا نویسنده</p>
        </div>
        <Link to="/admin/people" className="ms-auto inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/10">
          <ArrowRight className="h-4 w-4" /> بازگشت
        </Link>
      </div>
      <ErrorBox message={error} />
      <section className={`${cardCls} p-5`}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-start gap-4">
            {preview
              ? <img src={preview} alt="" className="h-24 w-24 rounded-2xl object-cover" />
              : <span className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/5 text-xs text-zinc-600">بدون عکس</span>}
            <div className="flex-1 space-y-2">
              <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="block w-full text-xs text-zinc-400 file:ml-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-zinc-200" />
              <input value={form.profile_image_url} onChange={set("profile_image_url")} placeholder="یا لینک عکس پروفایل (TMDB)" dir="ltr" className={inputCls} />
            </div>
          </div>
          <Field label="نام *" error={fieldErrors.name}><input value={form.name} onChange={set("name")} className={inputCls} required /></Field>
          <Field label="نام اصلی" error={fieldErrors.original_name}><input value={form.original_name} onChange={set("original_name")} className={inputCls} dir="ltr" /></Field>
          <Field label="TMDB ID *" error={fieldErrors.tmdb_id}><input value={form.tmdb_id} onChange={set("tmdb_id")} className={inputCls} dir="ltr" required /></Field>
          <Field label="اسلاگ" error={fieldErrors.slug} hint="خالی بماند خودکار ساخته می‌شود"><input value={form.slug} onChange={set("slug")} className={inputCls} dir="ltr" /></Field>
          <Field label="تاریخ تولد" error={fieldErrors.birth_date}><input type="date" value={form.birth_date} onChange={set("birth_date")} className={inputCls} /></Field>
          <Field label="تاریخ فوت" error={fieldErrors.death_date}><input type="date" value={form.death_date} onChange={set("death_date")} className={inputCls} /></Field>
          <Field label="محل تولد" error={fieldErrors.place_of_birth}><input value={form.place_of_birth} onChange={set("place_of_birth")} className={inputCls} /></Field>
          <Field label="محبوبیت (TMDB)" error={fieldErrors.popularity}><input type="number" step="0.01" value={form.popularity} onChange={set("popularity")} className={inputCls} /></Field>
          <div className="sm:col-span-2">
            <Field label="بیوگرافی" error={fieldErrors.biography}>
              <textarea rows={6} value={form.biography} onChange={set("biography")} className={`${inputCls} resize-y`} />
            </Field>
          </div>
        </div>
      </section>
      <div className="sticky bottom-4 mt-6 flex justify-end">
        <PrimaryBtn type="submit" disabled={saving} className="!px-8 !py-3">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} ذخیره
        </PrimaryBtn>
      </div>
    </form>
  )
}
