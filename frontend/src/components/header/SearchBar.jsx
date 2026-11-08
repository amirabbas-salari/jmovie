import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Film, Tv, User, Loader2 } from "lucide-react";
import api from "../../services/api"; // مسیر api خودت رو نگه دار

const EMPTY_RESULTS = { movies: [], series: [], people: [] };

export default function SearchBar({ open, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [value, setValue] = useState("");
  const [results, setResults] = useState(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // فوکوس خودکار موقع باز شدن
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else {
      setValue("");
      setResults(EMPTY_RESULTS);
      setActiveIndex(-1);
    }
  }, [open]);

  // واکشی نتایج با debounce؛ درخواست قبلی با تایپ جدید لغو می‌شود تا
  // پاسخ دیررسیده‌ی کوئری قبلی روی نتایج جدید ننشیند و شبکه هدر نرود.
  useEffect(() => {
    if (!value.trim()) {
      setResults(EMPTY_RESULTS);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const { data } = await api.get("/search/", { params: { q: value }, signal: controller.signal });
        setResults({
          movies: data.movies ?? [],
          series: data.series ?? [],
          people: data.people ?? [],
        });
        setActiveIndex(-1);
      } catch (err) {
        if (err?.name !== "CanceledError" && err?.code !== "ERR_CANCELED") {
          setResults(EMPTY_RESULTS);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [value]);

  // لیست تخت برای ناوبری با کیبورد
  const flatList = useMemo(() => {
    const m = results.movies.map((i) => ({ ...i, _path: `/movie/${i.slug}` }));
    const s = results.series.map((i) => ({ ...i, _path: `/series/${i.slug}` }));
    const p = results.people.map((i) => ({ ...i, _path: `/person/${i.slug}` }));
    return [...m, ...s, ...p];
  }, [results]);

  const go = (path) => {
    navigate(path);
    onClose?.();
  };

  const handleKeyDown = (e) => {
    if (!flatList.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatList.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flatList.length) % flatList.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = activeIndex >= 0 ? flatList[activeIndex] : flatList[0];
      if (item) go(item._path);
    } else if (e.key === "Escape") {
      onClose?.();
    }
  };

  const hasResults = flatList.length > 0;

  if (!open) return null;

  return (
    <div
      dir="rtl"
      className="
        mt-3
        rounded-2xl
        backdrop-blur-xl
        bg-white/10
        dark:bg-black/20
        border
        border-white/20
        shadow-lg
        shadow-black/20
        overflow-hidden
      "
    >
      {/* input */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <Search className="w-5 h-5 text-[#030A1F] dark:text-white shrink-0" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="جستجوی فیلم، سریال یا بازیگر..."
          className="
            flex-1
            bg-transparent
            outline-none
            text-[#030A1F]
            dark:text-white
            placeholder-gray-500
            dark:placeholder-gray-400
          "
        />
        {loading && (
          <Loader2 className="w-5 h-5 animate-spin text-[#27679f] dark:text-[#98b2ff]" />
        )}
      </div>

      {/* results */}
      {value.trim() && (
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!hasResults && !loading && (
            <p className="text-center py-6 text-gray-500 dark:text-gray-400">
              نتیجه‌ای یافت نشد
            </p>
          )}

          <Section
            title="فیلم‌ها"
            icon={Film}
            items={results.movies}
            type="movie"
            flatList={flatList}
            activeIndex={activeIndex}
            onPick={go}
          />
          <Section
            title="سریال‌ها"
            icon={Tv}
            items={results.series}
            type="series"
            flatList={flatList}
            activeIndex={activeIndex}
            onPick={go}
          />
          <Section
            title="عوامل"
            icon={User}
            items={results.people}
            type="person"
            flatList={flatList}
            activeIndex={activeIndex}
            onPick={go}
            round
          />
        </div>
      )}
    </div>
  );
}




function pathOf(type, item) {
  if (type === "movie") return `/movie/${item.slug}`;
  if (type === "series") return `/series/${item.slug}`;
  return `/person/${item.slug}`;
}

function Section({ title, icon: Icon, items, type, flatList, activeIndex, onPick, round }) {
  if (!items.length) return null;

  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400">
        <Icon className="w-4 h-4" />
        <span>{title}</span>
      </div>

      <ul>
        {items.map((item) => {
          const path = pathOf(type, item);
          const isActive = flatList[activeIndex]?._path === path;
          const img = item.profile_image_url || item.poster_url || "/avatar.webp";
          const label = item.name || item.original_title;

          return (
            <li key={`${type}-${item.slug}`}>
              <button
                type="button"
                onClick={() => onPick(path)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 rounded-lg text-right transition
                  text-[#030A1F] dark:text-gray-300
                  hover:bg-gray-100 hover:text-[#27679f]
                  dark:hover:bg-white/5 dark:hover:text-[#98b2ff]
                  ${isActive ? "bg-gray-100 dark:bg-white/5" : ""}
                `}
              >
                <img
                  src={img}
                  alt={label}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => { e.target.src = "/avatar.webp"; }}
                  className={`w-9 h-12 object-cover shrink-0 ${
                    round ? "rounded-full w-10 h-10" : "rounded-md"
                  }`}
                />
                <span className="truncate">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
