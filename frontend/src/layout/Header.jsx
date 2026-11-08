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
              rounded-2xl
              backdrop-blur-xl
              bg-white/10
              dark:bg-black/20
              border border-white/20
              shadow-lg shadow-black/20
            "
          />

          <div className="flex items-center justify-between h-full px-6">
            {/* Logo */}
            <a href="/" className="flex items-center gap-0 shrink-0">
              <img
                src={theme === "dark" ? "/Logo-red.svg" : "/Logo-dark.svg"}
                alt="لوگو"
                className="h-20 w-auto"
              />

              <span className="text-2xl font-extrabold text-white">
                مووی<span className="text-rose-500">ورس</span>
              </span>
            </a>

            {/* Desktop Nav */}
            <nav className="flex items-center gap-8 text-lg">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={`/${item.path}`}
                  className={({ isActive }) =>
                    isActive
                      ? "text-rose-500"
                      : "text-[#030A1F] hover:text-rose-500 dark:text-white dark:hover:text-rose-400"
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Right */}
            <div className="flex items-center gap-5">
              <button
                onClick={() => setSearchOpen((v) => !v)}
                className="text-[#030A1F] dark:text-white"
              >
                {searchOpen ? (
                  <X className="w-7 h-7" />
                ) : (
                  <Search className="w-7 h-7" />
                )}
              </button>

              <div className="relative">
                <Bell className="w-7 h-7" />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-pink-500" />
              </div>
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
