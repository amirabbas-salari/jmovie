import { Suspense, useState } from "react"
import { Outlet } from "react-router-dom"
import AdminSidebar from "../components/AdminSidebar"
import AdminTopbar from "../components/AdminTopbar"
import { useAdmin } from "../context/AdminContext"
import { Spinner } from "../components/ui"
import { useSeo } from "../../seo/useSeo"

export default function AdminLayout() {
  // پنل مدیریت هرگز نباید در موتورهای جستجو ایندکس شود.
  useSeo({ title: "پنل مدیریت | مووی‌ورس", noindex: true })

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { loading } = useAdmin()

  return (
    <div className="min-h-screen bg-[#09090b] font-sans text-zinc-100" dir="rtl">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-h-screen flex-col lg:pr-64">
        <AdminTopbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {loading ? (
            <Spinner text="در حال بررسی سطح دسترسی..." />
          ) : (
            <Suspense fallback={<Spinner />}>
              <Outlet />
            </Suspense>
          )}
        </main>
      </div>
    </div>
  )
}
