import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { getAdminMe } from "../services/adminApi"

const AdminContext = createContext(null)

// اطلاعات ادمین جاری + مجوزها یک بار گرفته و در کل پنل کش می‌شود.
// فرانت فقط برای «نمایش/مخفی‌کردن» دکمه‌ها از این استفاده می‌کند؛
// اجرای واقعی مجوز همیشه سمت بک‌اند است (403 برمی‌گرداند).
export const AdminProvider = ({ children }) => {
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const reload = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getAdminMe()
      setMe(data)
      setError("")
    } catch {
      setMe(null)
      setError("خطا در دریافت سطح دسترسی")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  const value = useMemo(() => {
    const permissions = me?.permissions ?? []
    const isSuperAdmin = Boolean(me?.is_superuser)
    const can = (perm) => {
      if (!perm) return true
      if (isSuperAdmin || permissions.includes("*")) return true
      return permissions.includes(perm)
    }
    return { me, loading, error, reload, can, isSuperAdmin, permissions }
  }, [me, loading, error, reload])

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

export const useAdmin = () => {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider")
  return ctx
}
