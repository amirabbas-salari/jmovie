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
      className="min-h-screen bg-gradient-to-b from-black to-[#1A0B0C] px-4 py-6 sm:px-6 sm:py-8 md:px-8"
    >
      <SideImage showOther={false} showMinions={false}/>

      {/* هاله‌های نوری */}
      <div className="pointer-events-none fixed -right-20 -top-20 h-60 w-60 rounded-full bg-fuchsia-600/20 blur-3xl sm:-right-40 sm:-top-40 sm:h-96 sm:w-96" />

      <div className="pointer-events-none fixed -left-20 top-20 h-60 w-60 rounded-full bg-blue-600/20 blur-3xl sm:-left-40 sm:top-40 sm:h-96 sm:w-96" />

      <div 
        className="relative mx-auto mt-20 max-w-[1500px] sm:mt-24 md:mt-28"
      >
        <h1 className="mb-6 text-center text-xl font-bold text-white sm:mb-10 sm:text-4xl">
          {title}
        </h1>

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
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 l:grid-cols-6">
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                key={index}
                className="aspect-[2/3] animate-pulse rounded-2xl bg-white/5"
              />
            ))}
          </div>
        ) : media.length === 0 ? (
          <p className="py-12 text-center text-sm text-white/60 sm:py-16 sm:text-base">
            فیلمی پیدا نشد.
          </p>
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