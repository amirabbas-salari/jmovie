import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Bell, Search, X } from "lucide-react";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

import ThemeToggle from "../components/ui/ThemeToggle";
import UserMenu from "../components/header/UserMenu";
import SearchBar from "../components/header/SearchBar";

import MobileHeader from "../components/header/MobileHeader";

const navItems = [
  { path: "home", label: "خانه" },
  { path: "movies", label: "فیلم‌ها" },
  { path: "series", label: "سریال‌ها" },
  { path: "collection", label: "مجموعه‌ها" },
  { path: "pricing", label: "حمایت از ما" },
  { path: "faq", label: "سوالات متداول" },
];

export default function Header() {
  const { theme } = useTheme();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      {/* Desktop Header */}
      <header
        dir="rtl"
        className="hidden lg:block fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[96%] max-w-screen-xl"
      >
        <div className="relative h-[72px]">
          {/* Glass */}
          <div
            className="
              absolute inset-0 -z-10
              overflow-hidden
              rounded-[22px]
              backdrop-blur-2xl
              bg-[#140a1e]/80
              border border-white/[0.13]
              shadow-glass
            "
          >
            <span className="absolute inset-x-10 top-0 h-px bg-gradient-to-l from-transparent via-rose-300/70 to-transparent" />
            <span className="absolute -left-16 top-0 h-full w-48 bg-fuchsia-500/10 blur-2xl" />
            <span className="absolute -right-16 top-0 h-full w-48 bg-rose-500/10 blur-2xl" />
          </div>

          <div className="flex items-center justify-between h-full px-6">
            {/* Logo */}
            <a href="/" className="flex items-center gap-0 shrink-0">
              <img
                src={theme === "dark" ? "/Logo-red.svg" : "/Logo-dark.svg"}
                alt="لوگو"
                className="h-20 w-auto"
              />

              <span className="text-2xl font-black text-white">
                مووی<span className="text-gradient">ورس</span>
              </span>
            </a>

            {/* Desktop Nav */}
            <nav className="flex items-center gap-1.5" aria-label="ناوبری اصلی">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={`/${item.path}`}
                  className={({ isActive }) =>
                    `nav-pill ${isActive ? "nav-pill-active" : ""}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Right */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                aria-label={searchOpen ? "بستن جستجو" : "جستجو"}
                className="icon-btn h-11 w-11"
              >
                {searchOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
              </button>

              <button type="button" aria-label="اعلان‌ها" className="icon-btn relative h-11 w-11">
                <Bell className="h-5 w-5" />
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rose-400 shadow-glow-sm" />
              </button>
              {/* <ThemeToggle /> //TODO */}
              <UserMenu />
            </div>
          </div>
        </div>

        <SearchBar
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
        />
      </header>

      {/* Mobile Header */}
      <div className="lg:hidden">
        <MobileHeader />
      </div>
    </>
  );
}
