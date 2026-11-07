import { Link } from "react-router-dom"
import { ShieldAlert } from "lucide-react"

export default function NotAuthorized() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-4" dir="rtl">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600/15 text-red-400">
          <ShieldAlert className="h-8 w-8" />
        </span>
        <h1 className="text-xl font-bold text-zinc-50">دسترسی ندارید</h1>
        <p className="mt-3 text-sm leading-7 text-zinc-400">
          حساب شما دسترسی ورود به پنل مدیریت را ندارد.
          اگر همکار سایت هستید، از سوپرادمین بخواهید برایتان نقش و سطح دسترسی تعریف کند.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/" className="rounded-xl bg-gradient-to-b from-[#C1121F] to-[#7F1D1D] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-125">
            بازگشت به سایت
          </Link>
          <Link to="/login" className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/10">
            ورود با حساب دیگر
          </Link>
        </div>
      </div>
    </div>
  )
}
