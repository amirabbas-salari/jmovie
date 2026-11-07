import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowRight, Loader2, Save, ShieldCheck } from "lucide-react"
import { rolesApi, usersApi, getApiError, getFieldErrors } from "../services/adminApi"
import { useAdmin } from "../context/AdminContext"
import { ErrorBox, Field, PrimaryBtn, Spinner, Toggle, cardCls, inputCls } from "../components/ui"

const emptyForm = {
  username: "", email: "", first_name: "", last_name: "", phone: "", password: "",
  is_active: true, is_vip: false, is_staff: false, is_superuser: false, role_ids: [],
}

export default function UserForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { isSuperAdmin, me } = useAdmin()
  const [form, setForm] = useState(emptyForm)
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState({})

  // نقش‌ها را فقط سوپرادمین می‌بیند/تغییر می‌دهد
  useEffect(() => {
    if (!isSuperAdmin) return
    rolesApi.list({ page_size: 100 }).then((d) => setRoles(d.items)).catch(() => {})
  }, [isSuperAdmin])

  useEffect(() => {
    if (!isEdit) return
    let alive = true
    usersApi.get(id)
      .then((d) => {
        if (!alive) return
        setForm({
          username: d.username || "", email: d.email || "", first_name: d.first_name || "",
          last_name: d.last_name || "", phone: d.phone || "", password: "",
          is_active: d.is_active !== false, is_vip: Boolean(d.is_vip),
          is_staff: Boolean(d.is_staff), is_superuser: Boolean(d.is_superuser),
          role_ids: (d.roles || []).map((r) => r.id),
        })
      })
      .catch(() => { if (alive) setError("بارگذاری کاربر با خطا مواجه شد.") })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id, isEdit])

  const set = (n) => (e) => { setForm((f) => ({ ...f, [n]: e.target.value })); setFieldErrors((p) => ({ ...p, [n]: undefined })) }
  const toggleRole = (rid) =>
    setForm((f) => ({ ...f, role_ids: f.role_ids.includes(rid) ? f.role_ids.filter((r) => r !== rid) : [...f.role_ids, rid] }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError(""); setFieldErrors({})
    try {
      const payload = { ...form }
      if (!payload.password) delete payload.password
      if (!isSuperAdmin) {
        // ادمین عادی هرگز این فیلدها را نمی‌فرستد؛ بک‌اند هم جلویش را می‌گیرد.
        delete payload.is_staff; delete payload.is_superuser; delete payload.role_ids
      }
      if (isEdit) await usersApi.update(id, payload); else await usersApi.create(payload)
      navigate("/admin/users")
    } catch (err) {
      setFieldErrors(getFieldErrors(err))
      setError(getApiError(err, "ذخیره‌ی کاربر با خطا مواجه شد."))
    } finally { setSaving(false) }
  }

  if (loading) return <Spinner />
  const isSelf = isEdit && Number(id) === me?.id

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-50 sm:text-2xl">{isEdit ? "ویرایش کاربر" : "افزودن کاربر"}</h1>
          <p className="mt-1 text-sm text-zinc-500">اطلاعات حساب و سطح دسترسی</p>
        </div>
        <Link to="/admin/users" className="ms-auto inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/10">
          <ArrowRight className="h-4 w-4" /> بازگشت
        </Link>
      </div>
      <ErrorBox message={error} />

      <div className="space-y-5">
        <section className={`${cardCls} p-5`}>
          <h2 className="mb-4 font-bold text-zinc-100">اطلاعات حساب</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="نام کاربری *" error={fieldErrors.username}><input value={form.username} onChange={set("username")} className={inputCls} dir="ltr" required /></Field>
            <Field label="ایمیل *" error={fieldErrors.email}><input type="email" value={form.email} onChange={set("email")} className={inputCls} dir="ltr" required /></Field>
            <Field label="نام" error={fieldErrors.first_name}><input value={form.first_name} onChange={set("first_name")} className={inputCls} /></Field>
            <Field label="نام خانوادگی" error={fieldErrors.last_name}><input value={form.last_name} onChange={set("last_name")} className={inputCls} /></Field>
            <Field label="موبایل" error={fieldErrors.phone}><input value={form.phone} onChange={set("phone")} className={inputCls} dir="ltr" /></Field>
            <Field label={isEdit ? "رمز عبور جدید (خالی = بدون تغییر)" : "رمز عبور *"} error={fieldErrors.password}>
              <input type="password" value={form.password} onChange={set("password")} className={inputCls} dir="ltr" required={!isEdit} autoComplete="new-password" />
            </Field>
          </div>
        </section>

        <section className={`${cardCls} space-y-3 p-5`}>
          <h2 className="font-bold text-zinc-100">وضعیت</h2>
          <Toggle label="حساب فعال" desc="کاربر غیرفعال نمی‌تواند وارد شود" checked={form.is_active} onChange={(v) => setForm((f) => ({ ...f, is_active: v }))} disabled={isSelf} />
          <Toggle label="کاربر VIP" desc="دسترسی به لینک‌های دانلود VIP" checked={form.is_vip} onChange={(v) => setForm((f) => ({ ...f, is_vip: v }))} />
        </section>

        {isSuperAdmin ? (
          <section className="rounded-2xl border border-red-500/25 bg-red-500/[0.04] p-5">
            <h2 className="mb-1 flex items-center gap-2 font-bold text-zinc-100">
              <ShieldCheck className="h-5 w-5 text-red-400" /> سطح دسترسی — فقط سوپرادمین
            </h2>
            <p className="mb-4 text-xs leading-6 text-zinc-500">
              «دسترسی به پنل» یعنی کاربر می‌تواند وارد پنل مدیریت شود، اما فقط در محدوده‌ی نقش‌هایی که این‌جا برایش انتخاب می‌کنید.
              سوپرادمین به همه‌چیز دسترسی دارد و نیازی به نقش ندارد.
            </p>
            <div className="space-y-3">
              <Toggle label="دسترسی به پنل مدیریت (Staff)" desc="شرط ورود به پنل" checked={form.is_staff} onChange={(v) => setForm((f) => ({ ...f, is_staff: v }))} disabled={isSelf} />
              <Toggle label="سوپرادمین" desc="دسترسی کامل + تعیین سطح دسترسی بقیه" checked={form.is_superuser} onChange={(v) => setForm((f) => ({ ...f, is_superuser: v, is_staff: v ? true : f.is_staff }))} disabled={isSelf} />
            </div>

            <p className="mb-2 mt-5 text-xs font-medium text-zinc-400">نقش‌های این کاربر:</p>
            {roles.length === 0
              ? <p className="text-xs text-zinc-500">هنوز نقشی ساخته نشده است. از بخش «نقش‌ها و دسترسی‌ها» نقش بسازید (یا دستور create_admin_roles را اجرا کنید).</p>
              : (
                <div className="flex flex-wrap gap-2">
                  {roles.map((r) => {
                    const active = form.role_ids.includes(r.id)
                    return (
                      <button key={r.id} type="button" onClick={() => toggleRole(r.id)}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${active ? "bg-red-600 text-white" : "border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"}`}>
                        {r.name} <span className="opacity-70">({r.users_count} نفر)</span>
                      </button>
                    )
                  })}
                </div>
              )}
          </section>
        ) : (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-6 text-zinc-500">
            تعیین سطح دسترسی (نقش، Staff و سوپرادمین) فقط توسط سوپرادمین انجام می‌شود.
          </p>
        )}
      </div>

      <div className="sticky bottom-4 mt-6 flex justify-end">
        <PrimaryBtn type="submit" disabled={saving} className="!px-8 !py-3">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} ذخیره
        </PrimaryBtn>
      </div>
    </form>
  )
}
