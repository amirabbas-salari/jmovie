import { Outlet } from "react-router-dom"

import Header from "./Header"
import Footer from "./Footer"
import BottomNavigation from "../components/navigation/BottomNavigation"

export default function MainLayout() {
  return (
    <div className="relative min-h-screen overflow-x-clip text-zinc-100">
      {/* هاله‌های نور محیطی */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] overflow-hidden">
        <div className="absolute -top-40 right-[8%] h-96 w-96 rounded-full bg-fuchsia-600/[0.13] blur-3xl" />
        <div className="absolute -top-32 left-[4%] h-80 w-80 rounded-full bg-rose-600/[0.12] blur-3xl" />
      </div>

      <div className="flex min-h-screen flex-col pb-24 lg:pb-10">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
        <BottomNavigation />
      </div>
    </div>
  )
}
