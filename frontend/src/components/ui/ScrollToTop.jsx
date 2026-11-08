import { useEffect } from "react"
import { useLocation } from "react-router-dom"

// با هر تغییر مسیر، صفحه از بالا باز می‌شود؛ قبلاً اسکرول صفحه‌ی قبلی
// می‌ماند و کاربر وسط صفحه‌ی جدید لند می‌شد.
export default function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }, [pathname])

  return null
}
