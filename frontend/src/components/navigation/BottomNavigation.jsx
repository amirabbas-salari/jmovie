import { NavLink } from "react-router-dom";
import {
  House,
  Clapperboard,
  Tv,
  LibraryBig,
  User,
} from "lucide-react";

const items = [
  { label: "خانه", icon: House, path: "/home" },
  { label: "فیلم", icon: Clapperboard, path: "/movies" },
  { label: "سریال", icon: Tv, path: "/series" },
  { label: "مجموعه", icon: LibraryBig, path: "/collection" },
  { label: "پروفایل", icon: User, path: "/profile" },
];

export default function BottomNavigation() {
  return (
    <nav
      aria-label="ناوبری موبایل"
      className="fixed bottom-3 left-1/2 z-[100] w-[96%] max-w-md -translate-x-1/2 lg:hidden"
    >
      <div className="relative flex h-[68px] items-center justify-around overflow-hidden rounded-[24px] border border-white/[0.13] bg-[#140a1e]/85 px-2 shadow-glass backdrop-blur-2xl">
        <span className="absolute inset-x-10 top-0 h-px bg-gradient-to-l from-transparent via-rose-300/60 to-transparent" />
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `group flex min-w-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1.5 text-[11px] font-medium transition-all duration-300 active:scale-95 ${
                  isActive ? "text-white" : "text-zinc-400 hover:text-zinc-100"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`grid h-8 w-10 place-items-center rounded-full transition-all duration-300 ${
                      isActive
                        ? "bg-brand-gradient text-white shadow-glow-sm"
                        : "text-zinc-400 group-hover:bg-white/[0.07] group-hover:text-white"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
