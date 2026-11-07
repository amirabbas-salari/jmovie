import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowRight, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react"
import { episodesApi, genresApi, seasonsApi, seriesApi, getApiError, getFieldErrors } from "../services/adminApi"
import { CastEditor, DownloadsManager, GalleryEditor } from "../components/editors"
import TmdbLookup from "../components/TmdbLookup"
import { Badge, ConfirmModal, ErrorBox, Field, GhostBtn, PrimaryBtn, Spinner, Toggle, cardCls, inputCls } from "../components/ui"

const emptyForm = {
  title: "", original_title: "", slug: "", imdb_id: "", tmdb_id: "", description: "",
  start_date: "", end_date: "", imdb_rating: "", imdb_votes: "", views: 0,
  poster_url: "", backdrop_url: "", is_ended: false, number_of_seasons: "", number_of_episodes: "",
  genre_ids: [],
}

const TABS = [
  { id: "main", label: "اطلاعات اصلی" },
  { id: "cast", label: "عوامل و بازیگران" },
  { id: "episodes", label: "فصل‌ها و قسمت‌ها" },
  { id: "gallery", label: "گالری" },
  { id: "downloads", label: "لینک‌های دانلود" },
]

export default function SeriesForm() {
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
    seriesApi.get(id)
      .then((data) => {
        if (!alive) return
        setForm({
          title: data.title || "", original_title: data.original_title || "",
          slug: data.slug || "", imdb_id: data.imdb_id || "", tmdb_id: data.tmdb_id ?? "",
          description: data.description || "", start_date: data.start_date || "",
          end_date: data.end_date || "", imdb_rating: data.imdb_rating ?? "",
          imdb_votes: data.imdb_votes ?? "", views: data.views ?? 0,
          poster_url: data.poster_url || "", backdrop_url: data.backdrop_url || "",
          is_ended: Boolean(data.is_ended),
          number_of_seasons: data.number_of_seasons ?? "", number_of_episodes: data.number_of_episodes ?? "",
          genre_ids: (data.genres || []).map((g) => g.id),
        })
        setCast((data.cast || []).map((c) => ({ person: c.person, role: c.role, character_name: c.character_name || "" })))
        setGallery((data.gallery || []).map((g) => ({ image_url: g.image_url || "", caption: g.caption || "", order: g.order || 0 })))
      })
      .catch(() => { if (alive) setError("بارگذاری سریال با خطا مواجه شد.") })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id, isEdit])

  const set = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value }))
    setFieldErrors((p) => ({ ...p, [name]: undefined }))
  }
  const toggleGenre = (gid) =>
    setForm((f) => ({ ...f, genre_ids: f.genre_ids.includes(gid) ? f.genre_ids.filter((g) => g !== gid) : [...f.genre_ids, gid] }))

  // پر کردن فرم از TMDB: فقط فیلدهای خالی پر می‌شوند
  const applyTmdb = (data, genreIds, castItems) => {
    setForm((f) => ({
      ...f,
      title: f.title || data.title || "",
      original_title: f.original_title || data.original_title || "",
      imdb_id: data.imdb_id || f.imdb_id,
      tmdb_id: data.tmdb_id ?? f.tmdb_id,
      description: f.description || data.description || "",
      start_date: f.start_date || data.start_date || "",
      end_date: f.end_date || data.end_date || "",
      imdb_rating: f.imdb_rating === "" ? (data.imdb_rating ?? "") : f.imdb_rating,
      imdb_votes: f.imdb_votes === "" ? (data.imdb_votes ?? "") : f.imdb_votes,
      poster_url: f.poster_url || data.poster_url || "",
      backdrop_url: f.backdrop_url || data.backdrop_url || "",
      number_of_seasons: f.number_of_seasons === "" ? (data.number_of_seasons ?? "") : f.number_of_seasons,
      number_of_episodes: f.number_of_episodes === "" ? (data.number_of_episodes ?? "") : f.number_of_episodes,
      is_ended: data.is_ended ?? f.is_ended,
      genre_ids: [...new Set([...f.genre_ids, ...genreIds])],
    }))
    if (castItems.length) setCast(castItems)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError(""); setFieldErrors({})
    try {
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
        savedId = isEdit ? (await seriesApi.update(id, fd)).id : (await seriesApi.create(fd)).id
      } else {
        const payload = {
          ...form,
          tmdb_id: form.tmdb_id === "" ? null : Number(form.tmdb_id),
          imdb_votes: form.imdb_votes === "" ? null : Number(form.imdb_votes),
          number_of_seasons: form.number_of_seasons === "" ? null : Number(form.number_of_seasons),
          number_of_episodes: form.number_of_episodes === "" ? null : Number(form.number_of_episodes),
          end_date: form.end_date || null,
        }
        savedId = isEdit ? (await seriesApi.update(id, payload)).id : (await seriesApi.create(payload)).id
      }
      const castItems = cast.filter((c) => c.person?.id).map((c) => ({
        person: c.person.id, role: c.role, character_name: c.character_name || "",
      }))
      await seriesApi.update(savedId, { cast_items: castItems, gallery_items: gallery })
      navigate("/admin/series")
    } catch (err) {
      setFieldErrors(getFieldErrors(err))
      setError(getApiError(err, "ذخیره‌ی سریال با خطا مواجه شد."))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Spinner text="در حال دریافت اطلاعات سریال..." />
  const posterPreview = posterFile ? URL.createObjectURL(posterFile) : form.poster_url
  const backdropPreview = backdropFile ? URL.createObjectURL(backdropFile) : form.backdrop_url

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-50 sm:text-2xl">{isEdit ? "ویرایش سریال" : "افزودن سریال جدید"}</h1>
          <p className="mt-1 text-sm text-zinc-500">همه‌ی اطلاعات سریال از همین‌جا قابل تغییر است.</p>
        </div>
        <Link to="/admin/series" className="ms-auto inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/10">
          <ArrowRight className="h-4 w-4" /> بازگشت به لیست
        </Link>
      </div>

      <ErrorBox message={error} />

      <TmdbLookup mediaType="series" onApply={applyTmdb} />

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
                <Field label="عنوان *" error={fieldErrors.title}><input value={form.title} onChange={set("title")} className={inputCls} required /></Field>
                <Field label="عنوان اصلی" error={fieldErrors.original_title}><input value={form.original_title} onChange={set("original_title")} className={inputCls} dir="ltr" /></Field>
                <Field label="IMDb ID *" error={fieldErrors.imdb_id}><input value={form.imdb_id} onChange={set("imdb_id")} className={inputCls} dir="ltr" required /></Field>
                <Field label="TMDB ID" error={fieldErrors.tmdb_id}><input type="number" value={form.tmdb_id} onChange={set("tmdb_id")} className={inputCls} dir="ltr" /></Field>
                <Field label="اسلاگ" error={fieldErrors.slug} hint="خالی بماند خودکار ساخته می‌شود"><input value={form.slug} onChange={set("slug")} className={inputCls} dir="ltr" /></Field>
                <Field label="بازدید" error={fieldErrors.views}><input type="number" min="0" value={form.views} onChange={set("views")} className={inputCls} /></Field>
                <div className="sm:col-span-2">
                  <Field label="خلاصه داستان" error={fieldErrors.description}>
                    <textarea rows={5} value={form.description} onChange={set("description")} className={`${inputCls} resize-y`} />
                  </Field>
                </div>
              </div>
            </section>

            <section className={`${cardCls} p-5`}>
              <h2 className="mb-4 font-bold text-zinc-100">تاریخ، امتیاز و قسمت‌ها</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="تاریخ شروع" error={fieldErrors.start_date}><input type="date" value={form.start_date} onChange={set("start_date")} className={inputCls} /></Field>
                <Field label="تاریخ پایان" error={fieldErrors.end_date} hint="خالی = در حال پخش"><input type="date" value={form.end_date} onChange={set("end_date")} className={inputCls} /></Field>
                <Field label="امتیاز IMDb" error={fieldErrors.imdb_rating}><input type="number" step="0.1" min="0" max="10" value={form.imdb_rating} onChange={set("imdb_rating")} className={inputCls} /></Field>
                <Field label="تعداد رأی" error={fieldErrors.imdb_votes}><input type="number" min="0" value={form.imdb_votes} onChange={set("imdb_votes")} className={inputCls} /></Field>
                <Field label="تعداد فصل" error={fieldErrors.number_of_seasons}><input type="number" min="0" value={form.number_of_seasons} onChange={set("number_of_seasons")} className={inputCls} /></Field>
                <Field label="تعداد قسمت" error={fieldErrors.number_of_episodes}><input type="number" min="0" value={form.number_of_episodes} onChange={set("number_of_episodes")} className={inputCls} /></Field>
              </div>
            </section>

            <section className={`${cardCls} p-5`}>
              <h2 className="mb-4 font-bold text-zinc-100">ژانرها</h2>
              <div className="flex flex-wrap gap-2">
                {genres.map((g) => {
                  const active = form.genre_ids.includes(g.id)
                  return (
                    <button key={g.id} type="button" onClick={() => toggleGenre(g.id)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${active ? "bg-red-600 text-white" : "border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"}`}>
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
                  <input value={form.poster_url} onChange={set("poster_url")} placeholder="یا لینک پوستر" dir="ltr" className={inputCls} />
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
              <Toggle label="به پایان رسیده" desc="پخش سریال تمام شده است" checked={form.is_ended} onChange={(v) => setForm((f) => ({ ...f, is_ended: v }))} />
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

      {tab === "episodes" && (
        <section className={`${cardCls} p-5`}>
          <h2 className="mb-4 font-bold text-zinc-100">فصل‌ها و قسمت‌ها</h2>
          <SeasonsManager seriesId={id} />
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
          <h2 className="mb-4 font-bold text-zinc-100">لینک‌های دانلود سریال</h2>
          <DownloadsManager targetType="series" objectId={id} />
        </section>
      )}

      <div className="sticky bottom-4 mt-6 flex justify-end">
        <PrimaryBtn type="submit" disabled={saving} className="!px-8 !py-3 shadow-2xl">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isEdit ? "ذخیره‌ی تغییرات" : "ساخت سریال"}
        </PrimaryBtn>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// مدیریت فصل‌ها و قسمت‌های یک سریال
// ---------------------------------------------------------------------------
function SeasonsManager({ seriesId }) {
  const [seasons, setSeasons] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSeason, setActiveSeason] = useState(null)
  const [newSeason, setNewSeason] = useState("")
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = () => {
    if (!seriesId) return
    setLoading(true)
    seasonsApi.list({ series: seriesId, page_size: 100, ordering: "season_number" })
      .then((d) => setSeasons(d.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(load, [seriesId])

  if (!seriesId) return <p className="text-sm text-zinc-500">برای مدیریت فصل‌ها و قسمت‌ها، اول اطلاعات اصلی سریال را ذخیره کنید.</p>
  if (loading) return <p className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> در حال بارگذاری فصل‌ها...</p>

  const addSeason = async () => {
    if (!newSeason) return
    const created = await seasonsApi.create({ series: Number(seriesId), season_number: Number(newSeason) })
    setSeasons((p) => [...p, created].sort((a, b) => a.season_number - b.season_number))
    setNewSeason("")
    setActiveSeason(created.id)
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await seasonsApi.remove(toDelete.id)
      setSeasons((p) => p.filter((s) => s.id !== toDelete.id))
      if (activeSeason === toDelete.id) setActiveSeason(null)
      setToDelete(null)
    } finally { setDeleting(false) }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {seasons.map((s) => (
          <span key={s.id} className={`inline-flex items-center gap-1 rounded-full border py-1 pl-1.5 pr-3 text-xs font-medium ${activeSeason === s.id ? "border-red-500/40 bg-red-600/20 text-red-200" : "border-white/10 bg-white/5 text-zinc-300"}`}>
            <button type="button" onClick={() => setActiveSeason(activeSeason === s.id ? null : s.id)}>
              فصل {s.season_number} <span className="text-zinc-500">({s.episodes_count ?? 0} قسمت)</span>
            </button>
            <button type="button" onClick={() => setToDelete(s)} className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-500 hover:bg-red-500/20 hover:text-red-300" aria-label="حذف فصل">
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <input type="number" min="1" value={newSeason} onChange={(e) => setNewSeason(e.target.value)} placeholder="شماره فصل" className="w-24 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs outline-none focus:border-red-500/40" />
          <button type="button" onClick={addSeason} className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500">
            <Plus className="h-3.5 w-3.5" /> فصل جدید
          </button>
        </span>
      </div>

      {activeSeason
        ? <EpisodesManager seasonId={activeSeason} />
        : <p className="text-sm text-zinc-500">برای دیدن و ویرایش قسمت‌ها، یک فصل را انتخاب کنید.</p>}

      {toDelete && (
        <ConfirmModal title="حذف فصل" message={`فصل ${toDelete.season_number} و همه‌ی قسمت‌هایش حذف شود؟`} loading={deleting} onCancel={() => setToDelete(null)} onConfirm={confirmDelete} />
      )}
    </div>
  )
}

const emptyEpisode = { episode_number: "", title: "", description: "", runtime: "", air_date: "", vote_average: "", still_image_url: "" }

function EpisodesManager({ seasonId }) {
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = () => {
    setLoading(true)
    episodesApi.list({ season: seasonId, page_size: 100, ordering: "episode_number" })
      .then((d) => setEpisodes(d.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(load, [seasonId])

  if (loading) return <p className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> در حال بارگذاری قسمت‌ها...</p>

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        ...form, season: Number(seasonId),
        episode_number: Number(form.episode_number),
        runtime: form.runtime === "" ? null : Number(form.runtime),
        vote_average: form.vote_average === "" ? null : form.vote_average,
        air_date: form.air_date || null,
      }
      if (form.id) await episodesApi.update(form.id, payload)
      else await episodesApi.create(payload)
      setForm(null); load()
    } finally { setSaving(false) }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try { await episodesApi.remove(toDelete.id); setEpisodes((p) => p.filter((e) => e.id !== toDelete.id)); setToDelete(null) }
    finally { setDeleting(false) }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="space-y-3">
      {episodes.length === 0 && !form && <p className="text-sm text-zinc-500">هنوز قسمتی برای این فصل ثبت نشده است.</p>}
      {episodes.map((ep) => (
        <div key={ep.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-3">
          <Badge tone="red">قسمت {ep.episode_number}</Badge>
          <span className="text-sm text-zinc-200">{ep.title}</span>
          <span className="text-xs text-zinc-500">{ep.runtime ? `${ep.runtime} دقیقه` : ""} {ep.air_date || ""}</span>
          <span className="ms-auto flex gap-1.5">
            <button type="button" onClick={() => setForm({ ...emptyEpisode, ...ep, air_date: ep.air_date || "", still_image_url: ep.still_image_url || "" })} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10" aria-label="ویرایش قسمت">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setToDelete(ep)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20" aria-label="حذف قسمت">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </span>
          <div className="w-full">
            <DownloadsManager targetType="episode" objectId={ep.id} />
          </div>
        </div>
      ))}

      {form ? (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4 sm:grid-cols-2">
          <Field label="شماره قسمت *"><input type="number" min="1" value={form.episode_number} onChange={set("episode_number")} className={inputCls} /></Field>
          <Field label="عنوان *"><input value={form.title} onChange={set("title")} className={inputCls} /></Field>
          <Field label="مدت (دقیقه)"><input type="number" min="0" value={form.runtime} onChange={set("runtime")} className={inputCls} /></Field>
          <Field label="تاریخ پخش"><input type="date" value={form.air_date} onChange={set("air_date")} className={inputCls} /></Field>
          <Field label="امتیاز"><input type="number" step="0.1" min="0" max="10" value={form.vote_average} onChange={set("vote_average")} className={inputCls} /></Field>
          <Field label="لینک تصویر قسمت"><input value={form.still_image_url} dir="ltr" onChange={set("still_image_url")} className={inputCls} /></Field>
          <div className="sm:col-span-2">
            <Field label="خلاصه قسمت"><textarea rows={3} value={form.description} onChange={set("description")} className={`${inputCls} resize-y`} /></Field>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <PrimaryBtn type="button" onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} ذخیره قسمت</PrimaryBtn>
            <GhostBtn type="button" onClick={() => setForm(null)}>انصراف</GhostBtn>
          </div>
        </div>
      ) : (
        <GhostBtn type="button" onClick={() => setForm({ ...emptyEpisode })}>
          <Plus className="h-4 w-4" /> افزودن قسمت
        </GhostBtn>
      )}

      {toDelete && (
        <ConfirmModal title="حذف قسمت" message={`قسمت ${toDelete.episode_number} «${toDelete.title}» حذف شود؟`} loading={deleting} onCancel={() => setToDelete(null)} onConfirm={confirmDelete} />
      )}
    </div>
  )
}
