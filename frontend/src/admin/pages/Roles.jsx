import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react"
import { getPermissionCatalog, rolesApi, usersApi, getApiError } from "../services/adminApi"
import { useAdmin } from "../context/AdminContext"
import { APP_LABELS, VERB_LABELS } from "../permissions"
import { Badge, ConfirmModal, EmptyState, ErrorBox, Field, GhostBtn, Modal, PrimaryBtn, Spinner, formatNumber, inputCls } from "../components/ui"

// صفحه‌ی مدیریت نقش‌ها — فقط سوپرادمین به آن دسترسی دارد (بک‌اند هم 403 می‌دهد).
export default function Roles() {
  const { isSuperAdmin, loading: adminLoading } = useAdmin()
  const [roles, setRoles] = useState([])
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState(null) // null | {} | role
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [admins, setAdmins] = useState([])

  const load = () => {
    setLoading(true)
    Promise.all([rolesApi.list({ page_size: 100 }), getPermissionCatalog(), usersApi.list({ role: "staff", page_size: 100 })])
      .then(([r, c, u]) => { setRoles(r.items); setCatalog(c); setAdmins(u.items) })
      .catch(() => setError("خطا در دریافت نقش‌ها"))
      .finally(() => setLoading(false))
  }
  useEffect(() => { if (isSuperAdmin) load() }, [isSuperAdmin])

  const grouped = useMemo(() => {
    const groups = {}
    catalog.forEach((p) => {
      const verb = p.codename.split("_")[0]
      if (!VERB_LABELS[verb]) return // فقط مجوزهای استاندارد مدل‌ها در ماتریس
      const key = p.app_label
      groups[key] = groups[key] || []
      groups[key].push(p)
    })
    return groups
  }, [catalog])

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await rolesApi.remove(toDelete.id)
      setRoles((p) => p.filter((r) => r.id !== toDelete.id))
      setToDelete(null)
    } finally { setDeleting(false) }
  }

  if (adminLoading) return <Spinner />
  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-red-500" />
        <h1 className="text-lg font-bold text-zinc-100">فقط سوپرادمین</h1>
        <p className="mt-2 text-sm leading-7 text-zinc-500">
          ساخت نقش و تعیین سطح دسترسی ادمین‌ها فقط توسط سوپرادمین انجام می‌شود.
        </p>
        <Link to="/admin" className="mt-5 inline-block"><PrimaryBtn>بازگشت به داشبورد</PrimaryBtn></Link>
      </div>
    )
  }
  if (loading) return <Spinner text="در حال بارگذاری نقش‌ها..." />

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-50 sm:text-2xl">نقش‌ها و سطح دسترسی</h1>
          <p className="mt-1 text-sm text-zinc-500">نقش بسازید، مجوزهایش را تیک بزنید و از صفحه‌ی ویرایش کاربر به ادمین‌ها بدهید.</p>
        </div>
        <span className="ms-auto">
          <PrimaryBtn onClick={() => setEditing({ name: "", permission_ids: [] })}>
            <Plus className="h-4 w-4" /> ساخت نقش جدید
          </PrimaryBtn>
        </span>
      </div>

      <ErrorBox message={error} />

      {roles.length === 0 ? <EmptyState text="هنوز نقشی ساخته نشده است." /> : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {roles.map((role) => (
            <section key={role.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600/15 text-red-300">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <p className="font-bold text-zinc-100">{role.name}</p>
                  <p className="text-[11px] text-zinc-500">{formatNumber(role.users_count)} کاربر — {formatNumber(role.permissions_detail.length)} مجوز</p>
                </div>
                <button onClick={() => setEditing(role)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-white/10">ویرایش مجوزها</button>
                <button onClick={() => setToDelete(role)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20" aria-label={`حذف نقش ${role.name}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {role.permissions_detail.slice(0, 14).map((p) => (
                  <Badge key={p.id}>{permLabel(p.codename)}</Badge>
                ))}
                {role.permissions_detail.length > 14 && <Badge>+{role.permissions_detail.length - 14} مورد دیگر</Badge>}
                {role.permissions_detail.length === 0 && <span className="text-xs text-zinc-600">بدون مجوز — اعضای این نقش عملاً کاری در پنل نمی‌توانند بکنند.</span>}
              </div>
              <MembersOfRole role={role} admins={admins} onChanged={load} />
            </section>
          ))}
        </div>
      )}

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="mb-2 font-bold text-zinc-100">راهنما</h2>
        <ul className="list-inside list-disc space-y-1.5 text-sm leading-7 text-zinc-400">
          <li><b className="text-zinc-200">سوپرادمین</b> (is_superuser) به همه‌چیز دسترسی دارد و تنها کسی است که نقش می‌سازد و سطح دسترسی تعیین می‌کند.</li>
          <li>برای همکار جدید: از «کاربران» او را بسازید، «دسترسی به پنل» را فعال کنید و نقشش را انتخاب کنید.</li>
          <li>با دستور <code dir="ltr" className="rounded bg-white/10 px-1.5 py-0.5 text-xs">python manage.py create_admin_roles</code> سه نقش آماده (مدیر محتوا، ناظر نظرات، پشتیبان کاربران) ساخته می‌شود.</li>
          <li>حذف یک نقش، دسترسی اعضای آن را فوراً می‌گیرد ولی حسابشان حذف نمی‌شود.</li>
        </ul>
      </section>

      {editing && (
        <RoleEditor
          role={editing}
          grouped={grouped}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
      {toDelete && (
        <ConfirmModal title="حذف نقش" message={`نقش «${toDelete.name}» حذف شود؟ دسترسی ${toDelete.users_count} عضو آن فوراً گرفته می‌شود.`} loading={deleting} onCancel={() => setToDelete(null)} onConfirm={confirmDelete} />
      )}
    </div>
  )
}

function permLabel(fullCodename) {
  const [app, codename] = fullCodename.split(".")
  const verb = codename.split("_")[0]
  return `${APP_LABELS[app] || app}: ${VERB_LABELS[verb] || codename}`
}

function MembersOfRole({ role, admins, onChanged }) {
  const [busy, setBusy] = useState(false)
  const toggle = async (user) => {
    const has = user.roles?.some((r) => r.id === role.id)
    const nextIds = has ? user.roles.filter((r) => r.id !== role.id).map((r) => r.id) : [...(user.roles || []).map((r) => r.id), role.id]
    setBusy(true)
    try { await usersApi.assignRoles(user.id, nextIds); onChanged() }
    finally { setBusy(false) }
  }
  if (admins.length === 0) return null
  return (
    <div className="mt-4 border-t border-white/5 pt-3">
      <p className="mb-2 text-[11px] text-zinc-500">عضویت سریع — ادمین‌ها:</p>
      <div className="flex flex-wrap gap-1.5">
        {admins.filter((u) => !u.is_superuser).map((u) => {
          const has = u.roles?.some((r) => r.id === role.id)
          return (
            <button key={u.id} disabled={busy} onClick={() => toggle(u)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition disabled:opacity-50 ${has ? "bg-red-600 text-white" : "border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"}`}>
              {u.username}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RoleEditor({ role, grouped, onClose, onSaved }) {
  const [name, setName] = useState(role.name || "")
  const [selected, setSelected] = useState(new Set(role.permission_ids || role.permissions_detail?.map((p) => p.id) || []))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const toggleGroup = (perms, checked) => setSelected((prev) => {
    const next = new Set(prev)
    perms.forEach((p) => (checked ? next.add(p.id) : next.delete(p.id)))
    return next
  })

  const save = async () => {
    if (!name.trim()) { setError("نام نقش الزامی است."); return }
    setSaving(true); setError("")
    try {
      const payload = { name: name.trim(), permission_ids: [...selected] }
      if (role.id) await rolesApi.update(role.id, payload)
      else await rolesApi.create(payload)
      onSaved()
    } catch (err) {
      setError(getApiError(err, "ذخیره‌ی نقش با خطا مواجه شد."))
    } finally { setSaving(false) }
  }

  return (
    <Modal title={role.id ? `ویرایش نقش «${role.name}»` : "ساخت نقش جدید"} onClose={onClose} wide>
      <ErrorBox message={error} />
      <Field label="نام نقش *">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: مدیر محتوا" className={inputCls} />
      </Field>

      <div className="mt-5 space-y-4">
        {Object.entries(grouped).map(([app, perms]) => {
          const allChecked = perms.every((p) => selected.has(p.id))
          return (
            <div key={app} className="rounded-xl border border-white/10 p-3.5">
              <label className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-zinc-200">
                <input type="checkbox" checked={allChecked} onChange={(e) => toggleGroup(perms, e.target.checked)} className="h-4 w-4 accent-red-600" />
                {APP_LABELS[app] || app}
                <span className="text-[11px] font-normal text-zinc-500">({perms.filter((p) => selected.has(p.id)).length}/{perms.length})</span>
              </label>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {perms.map((p) => (
                  <label key={p.id} className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="h-3.5 w-3.5 accent-red-600" />
                    {p.name.replace(/^(Can (view|add|change|delete)) /, "")} — {VERB_LABELS[p.codename.split("_")[0]] || ""}
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 flex gap-2">
        <PrimaryBtn onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} ذخیره نقش ({selected.size} مجوز)
        </PrimaryBtn>
        <GhostBtn onClick={onClose}>انصراف</GhostBtn>
      </div>
    </Modal>
  )
}
