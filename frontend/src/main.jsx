import React, { Suspense, lazy, useEffect, useState } from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import AppRoutes from "./routes/AppRoutes"
import { AuthProvider } from "./context/AuthContext"
import "./styles/global.css"
import { ThemeProvider } from "./context/ThemeContext"
import { CursorProvider } from "./context/CursorContext"

// افکت‌های کرسر (canvas) و چت هوش مصنوعی سنگین‌اند و در باندل اولیه لازم
// نیستند: تنبل لود می‌شوند و روی موبایل/لمسی یا با prefers-reduced-motion
// اصلاً اجرا نمی‌شوند تا باتری و CPU گوشی مصرف نشود.
const PremiumCursor = lazy(() => import("./components/cursor/PremiumCursor"))
const CursorTrail = lazy(() => import("./components/cursor/CursorTrail"))
const CursorParticles = lazy(() => import("./components/cursor/CursorParticles"))
const AIChat = lazy(() => import("./components/ai/AIChat"))

function DesktopEffects() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)")
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setEnabled(fine.matches && !reduced.matches)
    update()
    fine.addEventListener?.("change", update)
    reduced.addEventListener?.("change", update)
    return () => {
      fine.removeEventListener?.("change", update)
      reduced.removeEventListener?.("change", update)
    }
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
  useEffect(() => {
    // کمی بعد از لود اولیه تا با رندر صفحه رقابت نکند
    const t = setTimeout(() => setEnabled(true), 1500)
    return () => clearTimeout(t)
  }, [])
  if (!enabled) return null
  return (
    <Suspense fallback={null}>
      <AIChat />
    </Suspense>
  )
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <CursorProvider>
    <LazyAIChat />
    <DesktopEffects />
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <AppRoutes />
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  </CursorProvider>
)
