import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowRight, Loader2, Save } from "lucide-react"
import { genresApi, moviesApi, getApiError, getFieldErrors } from "../services/adminApi"
import { CastEditor, DownloadsManager, GalleryEditor } from "../components/editors"
import { ErrorBox, Field, PrimaryBtn, Spinner, Toggle, cardCls, inputCls } from "../components/ui"

const emptyForm = {
  title: "", original_title: "", slug: "", imdb_id: "", tmdb_id: "", country: "",
  description: "", release_date: "", runtime: "", imdb_rating: "", imdb_votes: "",
  views: 0, poster_url: "", backdrop_url: "", is_active: true, genre_ids: [],
}

const TABS = [
  { id: "main", label: "اطلاعات اصلی" },
  { id: "cast", label: "عوامل و بازیگران" },
  { id: "gallery", label: "گالری" },
  { id: "downloads", label: "لینک‌های دانلود" },
]

export default function MovieForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [tab, setTab] = useState("main")
  const [form, setForm] = useState(emptyForm)
  const [posterFile, setPosterFile] = useState(null)
  const [backdropFile, setBackdropFile] = useState(null)
  const [cast, setCast] = useState([])
  const [gallery, setGallery] = useState([])
  const [genres, setGenres] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    genresApi.list({ page_size: 100 }).then((d) => setGenres(d.items)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isEdit) return
    let alive = true
    moviesApi.get(id)
      .then((data) => {
        if (!alive) return
        setForm({
          title: data.title || "", original_title: data.original_title || "",
          slug: data.slug || "", imdb_id: data.imdb_id || "",
          tmdb_id: data.tmdb_id ?? "", country: data.country || "",
          description: data.description || "", release_date: data.release_date || "",
          runtime: data.runtime ?? "", imdb_rating: data.imdb_rating ?? "",
          imdb_votes: data.imdb_votes ?? "", views: data.views ?? 0,
          poster_url: data.poster_url || "", backdrop_url: data.backdrop_url || "",
          is_active: data.is_active !== false,
          genre_ids: (data.genres || []).map((g) => g.id),
        })
        setCast((data.cast || []).map((c) => ({
          person: c.person, role: c.role, character_name: c.character_name || "",
        })))
        setGallery((data.gallery || []).map((g) => ({
          image_url: g.image_url || "", caption: g.caption || "", order: g.order || 0,
        })))
      })
      .catch(() => { if (alive) setError("بارگذاری فیلم با خطا مواجه شد.") })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id, isEdit])

  const set = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value }))
    setFieldErrors((p) => ({ ...p, [name]: undefined }))
  }
  const toggleGenre = (gid) =>
    setForm((f) => ({ ...f, genre_ids: f.genre_ids.includes(gid) ? f.genre_ids.filter((g) => g !== gid) : [...f.genre_ids, gid] }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError(""); setFieldErrors({})
    try {
      // مرحله ۱: اطلاعات اصلی (+ فایل پوستر/بک‌گراند در صورت انتخاب)
      let savedId = id
      const hasFiles = posterFile || backdropFile
      if (hasFiles) {
        const fd = new FormData()
        Object.entries(form).forEach(([k, v]) => {
          if (k === "genre_ids") v.forEach((g) => fd.append("genre_ids", g))
          else if (v !== "" && v !== null && v !== undefined) fd.append(k, v)
        })
        if (posterFile) fd.append("poster", posterFile)
        if (backdropFile) fd.append("backdrop", backdropFile)
        savedId = isEdit ? (await moviesApi.update(id, fd)).id : (await moviesApi.create(fd)).id
      } else {
        const payload = { ...form, tmdb_id: form.tmdb_id === "" ? null : Number(form.tmdb_id) }
        savedId = isEdit ? (await moviesApi.update(id, payload)).id : (await moviesApi.create(payload)).id
      }
      // مرحله ۲: عوامل و گالری به‌صورت JSON (multipart ساختار تو در تو را پشتیبانی نمی‌کند)
      const castItems = cast.filter((c) => c.person?.id).map((c) => ({
        person: c.person.id, role: c.role, character_name: c.character_name || "",
      }))
      await moviesApi.update(savedId, { cast_items: castItems, gallery_items: gallery })
      navigate("/admin/movies")
    } catch (err) {
      setFieldErrors(getFieldErrors(err))
      setError(getApiError(err, "ذخیره‌ی فیلم با خطا مواجه شد."))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner text="در حال دریافت اطلاعات فیلم..." />

  const posterPreview = posterFile ? URL.createObjectURL(posterFile) : form.poster_url
  const backdropPreview = backdropFile ? URL.createObjectURL(backdropFile) : form.backdrop_url

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-50 sm:text-2xl">{isEdit ? "ویرایش فیلم" : "افزودن فیلم جدید"}</h1>
          <p className="mt-1 text-sm text-zinc-500">همه‌ی اطلاعات فیلم از همین‌جا قابل تغییر است.</p>
        </div>
        <Link to="/admin/movies" className="ms-auto inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/10">
          <ArrowRight className="h-4 w-4" /> بازگشت به لیست
        </Link>
      </div>

      <ErrorBox message={error} />

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] p-1">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`flex-1 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition ${tab === t.id ? "bg-red-600 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "main" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <section className={`${cardCls} p-5`}>
              <h2 className="mb-4 font-bold text-zinc-100">اطلاعات پایه</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="عنوان فارسی *" error={fieldErrors.title}><input value={form.title} onChange={set("title")} className={inputCls} required /></Field>
                <Field label="عنوان اصلی (انگلیسی)" error={fieldErrors.original_title}><input value={form.original_title} onChange={set("original_title")} className={inputCls} dir="ltr" /></Field>
                <Field label="IMDb ID *" error={fieldErrors.imdb_id} hint="مثل tt0816692"><input value={form.imdb_id} onChange={set("imdb_id")} className={inputCls} dir="ltr" required /></Field>
                <Field label="TMDB ID" error={fieldErrors.tmdb_id}><input type="number" value={form.tmdb_id} onChange={set("tmdb_id")} className={inputCls} dir="ltr" /></Field>
                <Field label="اسلاگ" error={fieldErrors.slug} hint="خالی بماند خودکار ساخته می‌شود"><input value={form.slug} onChange={set("slug")} className={inputCls} dir="ltr" /></Field>
                <Field label="کشور" error={fieldErrors.country}><input value={form.country} onChange={set("country")} className={inputCls} /></Field>
                <div className="sm:col-span-2">
                  <Field label="خلاصه داستان" error={fieldErrors.description}>
                    <textarea rows={5} value={form.description} onChange={set("description")} className={`${inputCls} resize-y`} />
                  </Field>
                </div>
              </div>
            </section>

            <section className={`${cardCls} p-5`}>
              <h2 className="mb-4 font-bold text-zinc-100">تاریخ، امتیاز و آمار</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="تاریخ انتشار" error={fieldErrors.release_date}><input type="date" value={form.release_date} onChange={set("release_date")} className={inputCls} /></Field>
                <Field label="مدت (دقیقه) *" error={fieldErrors.runtime}><input type="number" min="0" value={form.runtime} onChange={set("runtime")} className={inputCls} required /></Field>
                <Field label="امتیاز IMDb" error={fieldErrors.imdb_rating}><input type="number" step="0.1" min="0" max="10" value={form.imdb_rating} onChange={set("imdb_rating")} className={inputCls} /></Field>
                <Field label="تعداد رأی IMDb" error={fieldErrors.imdb_votes}><input type="number" min="0" value={form.imdb_votes} onChange={set("imdb_votes")} className={inputCls} /></Field>
                <Field label="بازدید" error={fieldErrors.views}><input type="number" min="0" value={form.views} onChange={set("views")} className={inputCls} /></Field>
              </div>
            </section>

            <section className={`${cardCls} p-5`}>
              <h2 className="mb-4 font-bold text-zinc-100">ژانرها</h2>
              <div className="flex flex-wrap gap-2">
                {genres.map((g) => {
                  const active = form.genre_ids.includes(g.id)
                  return (
                    <button key={g.id} type="button" onClick={() => toggleGenre(g.id)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${active ? "bg-red-600 text-white shadow-[0_6px_16px_-6px_rgba(193,18,31,0.8)]" : "border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"}`}>
                      {g.name}
                    </button>
                  )
                })}
                {genres.length === 0 && <span className="text-xs text-zinc-500">ژانری ثبت نشده است.</span>}
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section className={`${cardCls} p-5`}>
              <h2 className="mb-4 font-bold text-zinc-100">تصاویر</h2>
              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-xs text-zinc-400">پوستر</p>
                  {posterPreview && <img src={posterPreview} alt="پوستر" className="mb-2 aspect-[2/3] w-32 rounded-xl object-cover" />}
                  <input type="file" accept="image/*" onChange={(e) => setPosterFile(e.target.files?.[0] || null)} className="mb-2 block w-full text-xs text-zinc-400 file:ml-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-zinc-200" />
                  <input value={form.poster_url} onChange={set("poster_url")} placeholder="یا لینک پوستر (TMDB)" dir="ltr" className={inputCls} />
                </div>
                <div>
                  <p className="mb-2 text-xs text-zinc-400">بک‌گراند</p>
                  {backdropPreview && <img src={backdropPreview} alt="بک‌گراند" className="mb-2 aspect-video w-full rounded-xl object-cover" />}
                  <input type="file" accept="image/*" onChange={(e) => setBackdropFile(e.target.files?.[0] || null)} className="mb-2 block w-full text-xs text-zinc-400 file:ml-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-zinc-200" />
                  <input value={form.backdrop_url} onChange={set("backdrop_url")} placeholder="یا لینک بک‌گراند" dir="ltr" className={inputCls} />
                </div>
              </div>
            </section>
            <section className={`${cardCls} p-5`}>
              <h2 className="mb-4 font-bold text-zinc-100">وضعیت</h2>
              <Toggle label="فعال" desc="در سایت نمایش داده شود" checked={form.is_active} onChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
            </section>
          </div>
        </div>
      )}

      {tab === "cast" && (
        <section className={`${cardCls} p-5`}>
          <h2 className="mb-1 font-bold text-zinc-100">عوامل و بازیگران</h2>
          <p className="mb-4 text-xs text-zinc-500">با ذخیره‌ی فرم، این لیست جایگزین عوامل فعلی می‌شود.</p>
          <CastEditor items={cast} onChange={setCast} />
        </section>
      )}

      {tab === "gallery" && (
        <section className={`${cardCls} p-5`}>
          <h2 className="mb-1 font-bold text-zinc-100">گالری تصاویر</h2>
          <p className="mb-4 text-xs text-zinc-500">با ذخیره‌ی فرم، این لیست جایگزین گالری فعلی می‌شود.</p>
          <GalleryEditor items={gallery} onChange={setGallery} />
        </section>
      )}

      {tab === "downloads" && (
        <section className={`${cardCls} p-5`}>
          <h2 className="mb-4 font-bold text-zinc-100">لینک‌های دانلود فیلم</h2>
          <DownloadsManager targetType="movie" objectId={id} />
        </section>
      )}

      <div className="sticky bottom-4 mt-6 flex justify-end">
        <PrimaryBtn type="submit" disabled={saving} className="!px-8 !py-3 shadow-2xl">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isEdit ? "ذخیره‌ی تغییرات" : "ساخت فیلم"}
        </PrimaryBtn>
      </div>
    </form>
  )
}
