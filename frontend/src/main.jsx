import React, { Component, Suspense, lazy, useEffect, useState } from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import AppRoutes from "./routes/AppRoutes"
import { AuthProvider } from "./context/AuthContext"
import { MyListsProvider } from "./context/MyListsContext"
import "./styles/global.css"
import { ThemeProvider } from "./context/ThemeContext"
import { CursorProvider } from "./context/CursorContext"
import { MessageCircle } from "lucide-react"

// افکت‌های کرسر (canvas) و چت هوش مصنوعی سنگین‌اند و در باندل اولیه لازم
// نیستند: کرسرها تازه بعد از اولین حرکت موس لود می‌شوند (کاربر لمسی
// هیچ‌وقت دانلودشان نمی‌کند) و چت AI فقط با کلیک کاربر روی دکمه‌اش.
const PremiumCursor = lazy(() => import("./components/cursor/PremiumCursor"))
const CursorTrail = lazy(() => import("./components/cursor/CursorTrail"))
const CursorParticles = lazy(() => import("./components/cursor/CursorParticles"))
const AIChat = lazy(() => import("./components/ai/AIChat"))

// اگر هر جای اپ هنگام رندر کرش کند، به‌جای صفحه‌ی خالی یک پیام قابل‌فهم
// با دکمه‌ی تلاش مجدد نشان داده می‌شود تا کاربر در صفحه‌ی سیاه نماند.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#1A0B0C] px-6 text-center text-white">
          <p className="text-xl font-bold">مشکلی پیش آمد</p>
          <p className="max-w-sm text-sm leading-7 text-white/60">
            بارگذاری این صفحه با خطا مواجه شد. لطفاً دوباره تلاش کنید؛ اگر مشکل ادامه داشت، صفحه را رفرش کنید.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-gradient-to-r from-rose-500 to-[#751a6c] px-6 py-2.5 text-sm font-bold text-white transition hover:scale-[1.03] active:scale-95"
          >
            تلاش مجدد
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function DesktopEffects() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)")
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (!fine.matches || reduced.matches) return undefined

    // تا وقتی موس حرکت نکرده، افکت کرسر هم لازم نیست؛ دانلود و اجرای
    // سه کامپوننت canvas از مسیر رندر اولیه کاملاً خارج می‌شود.
    const onMove = () => setEnabled(true)
    window.addEventListener("pointermove", onMove, { once: true, passive: true })
    return () => window.removeEventListener("pointermove", onMove)
  }, [])

  if (!enabled) return null
  return (
    <Suspense fallback={null}>
      <PremiumCursor />
      <CursorTrail />
      <CursorParticles />
    </Suspense>
  )
}

function LazyAIChat() {
  const [enabled, setEnabled] = useState(false)

  if (!enabled) {
    // دکمه‌ی سبکِ جایگزین؛ خود چت (~۱۷۰KB) فقط با کلیک دانلود می‌شود.
    return (
      <button
        type="button"
        onClick={() => setEnabled(true)}
        aria-label="باز کردن دستیار هوشمند"
        className="
          fixed bottom-24 right-6 z-[9999]
          flex h-14 w-14 items-center justify-center
          rounded-full
          border border-white/10
          bg-[#8b1e2d]
          text-white
          shadow-[0_10px_40px_rgba(139,30,45,0.35)]
          transition-all duration-300
          hover:scale-105
          hover:bg-[#a82536]
          active:scale-95
        "
      >
        <MessageCircle size={24} strokeWidth={2} />
        <span
          className="
            absolute -right-0.5 -top-0.5
            h-3.5 w-3.5
            rounded-full
            border-2 border-[#1A0B0C]
            bg-emerald-500
          "
        />
      </button>
    )
  }

  return (
    <Suspense fallback={null}>
      <AIChat initialOpen />
    </Suspense>
  )
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
  <CursorProvider>
    <LazyAIChat />
    <DesktopEffects />
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <MyListsProvider>
            <ThemeProvider>
              <AppRoutes />
            </ThemeProvider>
          </MyListsProvider>
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  </CursorProvider>
  </ErrorBoundary>
)
