import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { AdminProvider } from "../context/AdminContext"
import { Spinner } from "../components/ui"

// گارد ورود به پنل: لاگین + staff بودن. مجوزهای ریزدانه داخل پنل از
// /admin/me/ خوانده می‌شوند و اجرای نهایی‌شان با بک‌اند است.
const AdminRoute = () => {
  const { user, isAuth, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner text="در حال بررسی دسترسی..." />

  if (!isAuth) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }

  if (!user?.is_staff && !user?.is_superuser) {
    return <Navigate to="/not-authorized" replace />
  }

  return (
    <AdminProvider>
      <Outlet />
    </AdminProvider>
  )
}

export default AdminRoute
