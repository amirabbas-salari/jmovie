import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  BadgeCheck, Check, Crown, Eye, EyeOff, Film, ImagePlus, Loader2, Lock,
  Mail, Phone, RotateCcw, Save, Shield, Trash2, User, X,
} from "lucide-react"
import api from "../../services/api"
import { useAuth } from "../../context/AuthContext"

const TABS = [
  { id: "profile", label: "پروفایل", icon: User, desc: "عکس و نمای حساب" },
  { id: "account", label: "اطلاعات حساب", icon: BadgeCheck, desc: "نام کاربری و تماس" },
  { id: "genres", label: "علاقه‌مندی‌ها", icon: Film, desc: "ژانرهای محبوبت" },
  { id: "security", label: "امنیت", icon: Shield, desc: "تغییر رمز عبور" },
]

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 pr-11 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-rose-500/50 focus:bg-white/[0.08] focus:ring-2 focus:ring-rose-500/20 disabled:opacity-60"

function passwordStrength(pw) {
  if (!pw) return { score: 0, label: "" }
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const labels = ["خیلی ضعیف", "ضعیف", "متوسط", "خوب", "عالی"]
  return { score, label: labels[Math.min(score, 4)] }
}

import { useSeo } from "../../seo/useSeo";

export default function EditProfilePage() {
  useSeo({ title: "پروفایل من | مووی‌ورس", path: "/profile", noindex: true });
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState("profile")
  const [accountInfo, setAccountInfo] = useState(null)

  const empty = {
    username: "", phone: "", avatar: null, favorite_genres: [],
    old_password: "", password: "", password2: "",
  }
  const [form, setForm] = useState(empty)
  const [original, setOriginal] = useState(empty)
  const [preview, setPreview] = useState(null)
  const [originalPreview, setOriginalPreview] = useState(null)
  const [genres, setGenres] = useState([])
  const [fieldErrors, setFieldErrors] = useState({})
  const [msg, setMsg] = useState({ error: "", success: "" })
  const [showPw, setShowPw] = useState({ old: false, next: false, confirm: false })

  // ---------- بارگذاری ----------
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [profileRes, genresRes] = await Promise.allSettled([
          api.get("/accounts/profile/"),
          api.get("/genres/"),
        ])
        if (!alive) return
        if (genresRes.status === "fulfilled") {
          const data = genresRes.value.data
          const list = Array.isArray(data) ? data : data?.results ?? []
          setGenres(list.map((g) => ({ id: g.id, name: g.name })))
        }
        if (profileRes.status === "rejected") {
          if (profileRes.reason?.response?.status === 401) {
            navigate("/login", { replace: true, state: { from: "/profile" } })
            return
          }
          setLoadError("خطا در دریافت اطلاعات کاربر؛ دوباره تلاش کنید.")
          return
        }
        const data = profileRes.value.data
        const init = {
          username: data.username || "",
          phone: data.phone || "",
          avatar: null,
          favorite_genres: (data.favorite_genres || []).map(Number),
          old_password: "", password: "", password2: "",
        }
        setForm(init)
        setOriginal(init)
        setPreview(data.avatar || null)
        setOriginalPreview(data.avatar || null)
        setAccountInfo(data)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [navigate])

  // پیام موفقیت خودکار پاک شود
  useEffect(() => {
    if (!msg.success) return
    const t = setTimeout(() => setMsg((m) => ({ ...m, success: "" })), 4500)
    return () => clearTimeout(t)
  }, [msg.success])

  // ---------- وضعیت تغییرات ----------
  const isDirty = useMemo(() => {
    const baseChanged =
      form.username !== original.username ||
      form.phone !== original.phone ||
      JSON.stringify([...form.favorite_genres].sort()) !== JSON.stringify([...original.favorite_genres].sort()) ||
      form.avatar !== null
    const pwChanged = Boolean(form.old_password || form.password || form.password2)
    return baseChanged || pwChanged
  }, [form, original])

  const dirtyTabs = useMemo(() => {
    const set = new Set()
    if (form.avatar) set.add("profile")
    if (form.username !== original.username || form.phone !== original.phone) set.add("account")
    if (JSON.stringify([...form.favorite_genres].sort()) !== JSON.stringify([...original.favorite_genres].sort())) set.add("genres")
    if (form.old_password || form.password || form.password2) set.add("security")
    return set
  }, [form, original])

  // ---------- هندلرها ----------
  const set = (name) => (e) => {
    setForm((p) => ({ ...p, [name]: e.target.value }))
    setFieldErrors((p) => ({ ...p, [name]: undefined }))
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setMsg({ error: "فایل انتخاب‌شده باید عکس باشد.", success: "" })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setMsg({ error: "حجم عکس پروفایل نباید بیشتر از ۵ مگابایت باشد.", success: "" })
      return
    }
    setForm((p) => ({ ...p, avatar: file }))
    setPreview(URL.createObjectURL(file))
    setMsg({ error: "", success: "" })
  }

  const removeNewAvatar = () => {
    setForm((p) => ({ ...p, avatar: null }))
    setPreview(originalPreview)
  }

  const toggleGenre = (id) =>
    setForm((prev) => ({
      ...prev,
      favorite_genres: prev.favorite_genres.includes(id)
        ? prev.favorite_genres.filter((x) => x !== id)
        : [...prev.favorite_genres, Number(id)],
    }))

  const discard = () => {
    setForm({ ...original })
    setPreview(originalPreview)
    setFieldErrors({})
    setMsg({ error: "", success: "" })
  }

  const validatePasswordChange = () => {
    if (!form.password && !form.password2 && !form.old_password) return null
    if (!form.old_password) return { old_password: "رمز فعلی را وارد کنید." }
    if (!form.password) return { password: "رمز جدید را وارد کنید." }
    if (form.password.length < 8) return { password: "رمز جدید باید حداقل ۸ کاراکتر باشد." }
    if (form.password !== form.password2) return { password2: "تکرار رمز با رمز جدید یکی نیست." }
    return null
  }

  const handleSubmit = async () => {
    const pwErrors = validatePasswordChange()
    if (pwErrors) {
      setFieldErrors(pwErrors)
      setTab("security")
      return
    }
    setSaving(true)
    setMsg({ error: "", success: "" })
    setFieldErrors({})
    try {
      const fd = new FormData()
      // فقط فیلدهای تغییریافته فرستاده می‌شوند
      if (form.username !== original.username) fd.append("username", form.username.trim())
      if (form.phone !== original.phone) fd.append("phone", form.phone.trim())
      const genresChanged =
        JSON.stringify([...form.favorite_genres].sort()) !== JSON.stringify([...original.favorite_genres].sort())
      if (form.avatar) fd.append("avatar", form.avatar)
      if (form.password) {
        fd.append("old_password", form.old_password)
        fd.append("password", form.password)
        fd.append("password2", form.password2)
      }

      const { data } = await api.patch("/accounts/profile/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      // ژانرها با JSON جدا فرستاده می‌شوند تا «خالی‌کردن همه» هم درست کار کند
      // (در multipart لیست خالی قابل ارسال نیست)
      if (genresChanged) {
        await api.patch("/accounts/profile/", { favorite_genres: form.favorite_genres })
      }

      const saved = {
        username: data.username ?? form.username,
        phone: data.phone ?? form.phone,
        avatar: null,
        favorite_genres: (data.favorite_genres ?? form.favorite_genres).map(Number),
        old_password: "", password: "", password2: "",
      }
      setForm(saved)
      setOriginal(saved)
      if (data.avatar) {
        setPreview(data.avatar)
        setOriginalPreview(data.avatar)
      } else if (form.avatar) {
        setPreview(preview)
        setOriginalPreview(preview)
      }
      setAccountInfo((prev) => ({ ...prev, ...data }))
      setMsg({ error: "", success: "تغییرات با موفقیت ذخیره شد ✓" })
      refreshUser?.()
    } catch (err) {
      const data = err?.response?.data
      if (data && typeof data === "object" && !data.detail) {
        setFieldErrors(data)
        setMsg({ error: "بعضی فیلدها خطا دارند؛ لطفاً بررسی کنید.", success: "" })
      } else {
        setMsg({ error: data?.detail || "خطا در ذخیره‌ی اطلاعات؛ دوباره تلاش کنید.", success: "" })
      }
    } finally {
      setSaving(false)
    }
  }

  // ---------- رندر ----------
  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen bg-gradient-to-b from-black to-[#08040d] px-4 pt-32 text-zinc-100">
        <div className="mx-auto max-w-6xl animate-pulse">
          <div className="mb-6 h-28 rounded-3xl bg-white/5" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            <div className="h-64 rounded-3xl bg-white/5" />
            <div className="h-64 rounded-3xl bg-white/5 md:col-span-3" />
          </div>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-gradient-to-b from-black to-[#08040d] px-4 pt-24 text-zinc-100">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <p className="mb-5 text-sm text-zinc-300">{loadError}</p>
          <button onClick={() => window.location.reload()} className="rounded-xl bg-gradient-to-b from-[#C1121F] to-[#7F1D1D] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-125">
            تلاش دوباره
          </button>
        </div>
      </div>
    )
  }

  const strength = passwordStrength(form.password)

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-black to-[#08040d] px-4 pb-40 pt-28 text-zinc-100 sm:pt-32">
      {/* هاله‌ی نور برند */}
      <div aria-hidden className="pointer-events-none fixed -right-32 top-0 h-96 w-96 rounded-full bg-red-700/15 blur-[120px]" />

      <div className="relative mx-auto max-w-6xl">
        {/* ===== هدر پروفایل ===== */}
        <section className="mb-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl">
          <div className="h-20 bg-gradient-to-l from-[#7F1D1D] via-[#C1121F]/60 to-transparent sm:h-24" />
          <div className="flex flex-wrap items-center gap-4 px-5 pb-5 sm:px-7">
            <div className="relative -mt-10 shrink-0">
              {preview
                ? <img src={preview} alt="عکس پروفایل" className="h-24 w-24 rounded-full border-4 border-[#160809] object-cover" />
                : <span className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#160809] bg-gradient-to-b from-[#C1121F] to-[#7F1D1D] text-3xl font-bold text-white">{form.username?.[0]?.toUpperCase() || "?"}</span>}
              {form.avatar && <span className="absolute bottom-1 left-1 h-4 w-4 rounded-full border-2 border-[#160809] bg-amber-400" title="عکس جدید هنوز ذخیره نشده" />}
            </div>
            <div className="min-w-0 flex-1 pt-2">
              <h1 className="truncate text-xl font-bold text-white">{form.username}</h1>
              <p className="truncate text-sm text-zinc-500" dir="ltr" style={{ textAlign: "right" }}>{accountInfo?.email}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {accountInfo?.is_vip
                  ? <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300"><Crown className="h-3 w-3" /> کاربر VIP</span>
                  : <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-zinc-400">کاربر عادی — همه‌چیز رایگان است 🎬</span>}
                {accountInfo?.is_staff && <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-medium text-red-300">تیم مووی‌ورس</span>}
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-zinc-400">{form.favorite_genres.length} ژانر محبوب</span>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {/* ===== تب‌ها ===== */}
          <nav className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible">
            {TABS.map(({ id, label, icon: Icon, desc }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`relative flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-3 text-right transition md:w-full ${
                  tab === id
                    ? "border-red-500/40 bg-red-600/15 text-white"
                    : "border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${tab === id ? "text-red-400" : ""}`} />
                <span className="leading-tight">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="mt-0.5 hidden text-[11px] text-zinc-500 md:block">{desc}</span>
                </span>
                {dirtyTabs.has(id) && <span className="absolute left-3 top-3 h-2 w-2 rounded-full bg-amber-400" title="تغییر ذخیره‌نشده" />}
              </button>
            ))}
          </nav>

          {/* ===== محتوای تب‌ها ===== */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:p-7 md:col-span-3">
            {tab === "profile" && (
              <div>
                <h2 className="mb-1 text-lg font-bold text-white">عکس پروفایل</h2>
                <p className="mb-6 text-sm text-zinc-500">عکسی که کنار نظرها و در منوی کاربری نمایش داده می‌شود.</p>
                <div className="flex flex-col items-center gap-5 sm:flex-row">
                  {preview
                    ? <img src={preview} alt="پیش‌نمایش" className="h-32 w-32 rounded-full object-cover ring-2 ring-white/10" />
                    : <span className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-b from-[#C1121F] to-[#7F1D1D] text-4xl font-bold text-white">{form.username?.[0]?.toUpperCase() || "?"}</span>}
                  <div className="flex flex-col items-center gap-2.5 sm:items-start">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-b from-[#C1121F] to-[#7F1D1D] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-125">
                      <ImagePlus className="h-4 w-4" /> انتخاب عکس جدید
                      <input type="file" accept="image/*" hidden onChange={handleFile} />
                    </label>
                    {form.avatar && (
                      <button onClick={removeNewAvatar} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-zinc-300 transition hover:bg-white/10">
                        <Trash2 className="h-3.5 w-3.5" /> حذف عکس جدید و برگشت به قبلی
                      </button>
                    )}
                    <p className="text-[11px] text-zinc-600">فرمت‌های تصویری، حداکثر ۵ مگابایت — برای ذخیره، دکمه‌ی «ذخیره‌ی تغییرات» پایین صفحه را بزنید.</p>
                  </div>
                </div>
              </div>
            )}

            {tab === "account" && (
              <div>
                <h2 className="mb-1 text-lg font-bold text-white">اطلاعات حساب</h2>
                <p className="mb-6 text-sm text-zinc-500">نام کاربری در نظرها و لیست‌هایت نمایش داده می‌شود.</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="نام کاربری" error={fieldErrors.username}>
                    <div className="relative">
                      <User className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input name="username" value={form.username} onChange={set("username")} className={inputCls} dir="ltr" placeholder="username" />
                    </div>
                  </Field>
                  <Field label="شماره موبایل" error={fieldErrors.phone} hint="برای بازیابی حساب و اطلاع‌رسانی">
                    <div className="relative">
                      <Phone className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input name="phone" value={form.phone || ""} onChange={set("phone")} className={inputCls} dir="ltr" placeholder="09123456789" inputMode="tel" />
                    </div>
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="ایمیل" hint="ایمیل برای ورود و بازیابی حساب استفاده می‌شود و از این‌جا قابل تغییر نیست؛ برای تغییرش با پشتیبانی در تماس باش.">
                      <div className="relative">
                        <Mail className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <input value={accountInfo?.email || ""} disabled className={inputCls} dir="ltr" />
                        <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                      </div>
                    </Field>
                  </div>
                </div>
              </div>
            )}

            {tab === "genres" && (
              <div>
                <h2 className="mb-1 text-lg font-bold text-white">ژانرهای محبوب</h2>
                <p className="mb-6 text-sm text-zinc-500">
                  {form.favorite_genres.length > 0
                    ? `${form.favorite_genres.length} ژانر انتخاب شده — پیشنهادهای سایت بر اساس این‌ها شخصی‌سازی می‌شود.`
                    : "ژانرهایی که دوست داری را انتخاب کن تا پیشنهادهای بهتری بگیری."}
                </p>
                {genres.length === 0 ? (
                  <p className="text-sm text-zinc-500">ژانری برای نمایش نیست.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {genres.map((g) => {
                      const active = form.favorite_genres.includes(g.id)
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleGenre(g.id)}
                          aria-pressed={active}
                          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${
                            active
                              ? "bg-gradient-to-b from-[#C1121F] to-[#7F1D1D] text-white shadow-[0_8px_20px_-8px_rgba(193,18,31,0.9)]"
                              : "border border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
                          }`}
                        >
                          {active && <Check className="h-3.5 w-3.5" />}
                          {g.name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === "security" && (
              <div>
                <h2 className="mb-1 text-lg font-bold text-white">تغییر رمز عبور</h2>
                <p className="mb-6 text-sm text-zinc-500">برای امنیت حساب، اول رمز فعلی را وارد کن. اگر نمی‌خواهی رمز را عوض کنی این بخش را خالی بگذار.</p>
                <div className="max-w-md space-y-4">
                  <PasswordField
                    label="رمز فعلی" name="old_password" value={form.old_password} onChange={set("old_password")}
                    error={fieldErrors.old_password} show={showPw.old}
                    onToggle={() => setShowPw((s) => ({ ...s, old: !s.old }))} autoComplete="current-password"
                  />
                  <div>
                    <PasswordField
                      label="رمز جدید" name="password" value={form.password} onChange={set("password")}
                      error={fieldErrors.password} show={showPw.next}
                      onToggle={() => setShowPw((s) => ({ ...s, next: !s.next }))} autoComplete="new-password"
                    />
                    {form.password && (
                      <div className="mt-2">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= strength.score ? (strength.score >= 4 ? "bg-emerald-500" : strength.score >= 2 ? "bg-amber-400" : "bg-red-500") : "bg-white/10"}`} />
                          ))}
                        </div>
                        <p className="mt-1.5 text-[11px] text-zinc-500">قدرت رمز: {strength.label} — حداقل ۸ کاراکتر، ترکیب حرف و عدد بهتر است.</p>
                      </div>
                    )}
                  </div>
                  <PasswordField
                    label="تکرار رمز جدید" name="password2" value={form.password2} onChange={set("password2")}
                    error={fieldErrors.password2} show={showPw.confirm}
                    onToggle={() => setShowPw((s) => ({ ...s, confirm: !s.confirm }))} autoComplete="new-password"
                  />
                </div>
              </div>
            )}

            {/* پیام‌ها */}
            {msg.error && (
              <p className="mt-6 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                <X className="h-4 w-4 shrink-0" /> {msg.error}
              </p>
            )}
            {msg.success && (
              <p className="mt-6 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                <Check className="h-4 w-4 shrink-0" /> {msg.success}
              </p>
            )}
          </section>
        </div>
      </div>

      {/* ===== نوار ذخیره‌ی چسبان (فقط وقتی تغییری هست) ===== */}
      {isDirty && (
        <div className="fixed inset-x-0 bottom-24 z-40 px-4 lg:bottom-6">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-2xl border border-white/15 bg-zinc-900/90 px-4 py-3 shadow-2xl backdrop-blur-xl">
            <span className="flex items-center gap-2 text-sm text-amber-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
              تغییرات ذخیره‌نشده داری
            </span>
            <span className="ms-auto flex gap-2">
              <button onClick={discard} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/10 disabled:opacity-50">
                <RotateCcw className="h-4 w-4" /> بی‌خیال
              </button>
              <button onClick={handleSubmit} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-[#C1121F] to-[#7F1D1D] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-125 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "در حال ذخیره..." : "ذخیره‌ی تغییرات"}
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, error, hint, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-zinc-400">{label}</label>
      {children}
      {error
        ? <p className="mt-1.5 text-[11px] text-red-400">{Array.isArray(error) ? error[0] : error}</p>
        : hint && <p className="mt-1.5 text-[11px] leading-5 text-zinc-600">{hint}</p>}
    </div>
  )
}

function PasswordField({ label, error, show, onToggle, ...props }) {
  return (
    <Field label={label} error={error}>
      <div className="relative">
        <Lock className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input {...props} type={show ? "text" : "password"} className={inputCls} dir="ltr" />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? "پنهان کردن رمز" : "نمایش رمز"}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 transition hover:text-zinc-200"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  )
}
