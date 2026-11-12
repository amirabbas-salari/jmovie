import { useState } from "react"
import { CloudDownload, Loader2, Sparkles } from "lucide-react"
import { genresApi, peopleApi, tmdbLookup, getApiError } from "../services/adminApi"
import { GhostBtn, PrimaryBtn, inputCls } from "./ui"

// باکس «دریافت خودکار از TMDB» در بالای فرم فیلم/سریال:
// با IMDb ID یا TMDB ID اطلاعات + عوامل + ژانرها را می‌گیرد؛
// ژانر/فردی که در دیتابیس نباشد به‌صورت خودکار ساخته می‌شود.
export default function TmdbLookup({ mediaType, onApply }) {
  const [by, setBy] = useState("imdb_id")
  const [value, setValue] = useState("")
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState(null)

  const search = async () => {
    if (!value.trim()) return
    setLoading(true); setError(""); setResult(null)
    try {
      const data = await tmdbLookup({ type: mediaType, by, value: value.trim() })
      setResult(data)
    } catch (err) {
      setError(getApiError(err, "دریافت از TMDB ناموفق بود."))
    } finally {
      setLoading(false)
    }
  }

  const apply = async () => {
    if (!result) return
    setApplying(true); setError("")
    try {
      // ژانرهای گمشده را بساز و آیدی نهایی همه را جمع کن
      const genreIds = []
      for (const g of result.genres || []) {
        if (g.local_id) genreIds.push(g.local_id)
        else {
          try {
            const created = await genresApi.create({ name: g.name, slug: `tmdb-${g.tmdb_id}`, tmdb_id: g.tmdb_id, is_active: true })
            genreIds.push(created.id)
          } catch { /* ژانر تکراری یا خطای ساخت — رد می‌شویم */ }
        }
      }
      // افراد گمشده را بساز تا عوامل کامل وصل شوند
      const castItems = []
      for (const c of result.cast || []) {
        let personId = c.local_id
        if (!personId) {
          try {
            const created = await peopleApi.create({
              tmdb_id: c.tmdb_id, name: c.name, profile_image_url: c.profile_image_url || null,
            })
            personId = created.id
          } catch { continue }
        }
        castItems.push({
          person: { id: personId, name: c.name, profile_image_url: c.profile_image_url },
          role: c.role,
          character_name: c.character_name || "",
        })
      }
      onApply(result, genreIds, castItems)
      setResult(null)
      setValue("")
    } catch {
      setError("اعمال اطلاعات با خطا مواجه شد.")
    } finally {
      setApplying(false)
    }
  }

  return (
    <section className="mb-5 rounded-2xl border border-red-500/25 bg-gradient-to-l from-red-950/50 to-white/[0.02] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 text-sm font-bold text-zinc-100">
          <Sparkles className="h-4 w-4 text-red-400" /> دریافت خودکار از TMDB
        </span>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <select value={by} onChange={(e) => setBy(e.target.value)} className="w-32 shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-red-500/40">
            <option value="imdb_id">IMDb ID</option>
            <option value="tmdb_id">TMDB ID</option>
          </select>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search() } }}
            placeholder={by === "imdb_id" ? "tt0816692" : "27205"}
            dir="ltr"
            className={`${inputCls} min-w-[160px] flex-1`}
          />
          <PrimaryBtn type="button" onClick={search} disabled={loading || !value.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
            دریافت
          </PrimaryBtn>
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}

      {result && (
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-black/30 p-3">
          {result.poster_url && <img src={result.poster_url} alt="" className="h-20 w-14 rounded-lg object-cover" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-zinc-50">{result.title} <span className="font-normal text-zinc-500" dir="ltr">({result.original_title})</span></p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">{result.description}</p>
            <p className="mt-1 text-[11px] text-zinc-500">
              ⭐ {result.imdb_rating ?? "—"} • {(result.genres || []).map((g) => g.name).join("، ")} • {(result.cast || []).length} نفر از عوامل
              {(result.gallery_images?.length ?? 0) > 0 && ` • ${result.gallery_images.length} تصویر گالری`}
              {(result.genres || []).some((g) => !g.local_id) && " • چند ژانر جدید ساخته می‌شود"}
            </p>
          </div>
          <div className="flex gap-2">
            <PrimaryBtn type="button" onClick={apply} disabled={applying}>
              {applying && <Loader2 className="h-4 w-4 animate-spin" />} اعمال در فرم
            </PrimaryBtn>
            <GhostBtn type="button" onClick={() => setResult(null)}>انصراف</GhostBtn>
          </div>
        </div>
      )}
      <p className="mt-2 text-[11px] text-zinc-600">فیلدهای خالی فرم با اطلاعات TMDB پر می‌شوند؛ ژانرها و افرادی که در سایت نیستند خودکار ساخته می‌شوند و تا ۵ تصویر هم به گالری اضافه می‌شود.</p>
    </section>
  )
}
