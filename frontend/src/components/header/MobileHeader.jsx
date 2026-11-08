import { Search, X } from "lucide-react";
import { useState } from "react";

import { useTheme } from "../../context/ThemeContext";
import UserMenu from "./UserMenu";
import SearchBar from "./SearchBar";

export default function MobileHeader() {
  const { theme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  

  return (
    <header
      className="
      fixed
      top-3
      left-1/2
      -translate-x-1/2
      z-50
      w-[96%]
      lg:hidden
      "
    >
      <div
        className="
        relative
        h-14
        overflow-hidden
        rounded-[20px]
        border border-white/[0.13]
        bg-[#140a1e]/85
        backdrop-blur-2xl
        shadow-glass
        px-3
        flex
        items-center
        justify-between
        "
      >
        <span className="absolute inset-x-8 top-0 h-px bg-gradient-to-l from-transparent via-rose-300/70 to-transparent" />
        <a href="/" className="flex items-center gap-2">
          <img
            src={theme === "dark" ? "/Logo-red.svg" : "/Logo-dark.svg"}
            className="h-10"
            alt=""
          />

          <span className="font-black text-white text-xl">
            مووی
            <span className="text-gradient">ورس</span>
          </span>
        </a>

        <div className="flex items-center gap-2">

          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label={searchOpen ? "بستن جستجو" : "جستجو"}
            className="icon-btn h-10 w-10"
          >
            {searchOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Search className="h-5 w-5" />
            )}
          </button>

          <UserMenu />
        </div>
      </div>
      {/* Search Bar */}
      <SearchBar
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </header>
  );
}