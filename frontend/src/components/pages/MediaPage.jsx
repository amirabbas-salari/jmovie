import SideImage from "../../components/ui/SideImages";
import AdvanceSearch from "../../components/media/AdvanceSearch";
import MediaCard from "../../components/media/MediaCard";
import Pagination from "../ui/Pagination";
import { MdTitle } from "react-icons/md";

export default function MediaPage({
  title,
  type,
  media,
  filters,
  setFilters,
  error,
  loading,
  page,
  setPage,
  pagination,
}) {
  const update = (patch) => {
    setFilters((prev) => ({
      ...prev,
      ...patch,
    }));
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen px-4 py-6 sm:px-6 sm:py-8 md:px-8"
    >
      <SideImage showOther={false} showMinions={false}/>

      {/* هاله‌های نوری */}
      <div className="pointer-events-none fixed -right-20 -top-20 h-60 w-60 rounded-full bg-fuchsia-600/[0.13] blur-3xl sm:-right-40 sm:-top-40 sm:h-96 sm:w-96" />

      <div className="pointer-events-none fixed -left-20 top-20 h-60 w-60 rounded-full bg-rose-600/[0.12] blur-3xl sm:-left-40 sm:top-40 sm:h-96 sm:w-96" />

      <div
        className="relative mx-auto mt-20 max-w-[1500px] sm:mt-24 md:mt-28"
      >
        <header className="mb-7 text-center sm:mb-10">
          <p className="section-eyebrow mb-2">
            {type === "series" ? "آرشیو سریال‌ها" : "آرشیو فیلم‌ها"}
          </p>
          <h1 className="text-3xl font-black text-white sm:text-5xl">
            {title === "فیلم‌ها" ? <>فیلم‌های <span className="text-gradient">مووی‌ورس</span></> : title === "سریال‌ها" ? <>سریال‌های <span className="text-gradient">مووی‌ورس</span></> : title}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-zinc-400">
            {pagination?.count
              ? `${pagination.count.toLocaleString("fa-IR")} اثر برای تماشا و دانلود`
              : "جدیدترین و محبوب‌ترین آثار را با فیلترهای پیشرفته پیدا کنید."}
          </p>
        </header>

        {/* //TODO */}
        <AdvanceSearch
          type="movies"
          filters={filters}
          onChange={update}
        />

        {error && (
          <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </p>
        )}

        {loading ? (
          <div className="mt-8 grid grid-cols-2 justify-items-center gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="w-full max-w-[230px] space-y-2">
                <div className="skeleton aspect-[2/3] w-full" />
                <div className="h-3 w-4/5 rounded-full bg-white/[0.08]" />
                <div className="ml-auto h-3 w-3/5 rounded-full bg-white/[0.05]" />
              </div>
            ))}
          </div>
        ) : media.length === 0 ? (
          <div className="glass mx-auto mt-8 max-w-lg rounded-[26px] px-6 py-14 text-center">
            <p className="text-base font-bold text-white">اثری پیدا نشد</p>
            <p className="mt-2 text-sm leading-7 text-zinc-400">
              فیلترها را تغییر دهید یا عبارت دیگری جستجو کنید.
            </p>
          </div>
        ) : (
          <div className="mt-8 justify-items-center grid grid-cols-2 gap-3 sm:mt-10 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 md lg:grid-cols-5 xl:grid-cols-6">
            {media.map((item) => (
              <MediaCard
                key={item.slug}
                media={item}
                type={type}
              />
            ))}

          </div>

        )}
        
        {!loading && media.length > 0 && (
            <Pagination
                page={page}
                totalPages={pagination.totalPages}
                onChange={setPage}
            />
        )}
        
      </div>
    </div>
  );
}