import { Search, SlidersHorizontal, AlertCircle } from "lucide-react";
import useCollections from "../../hooks/useCollections";
import SideImages from "../../components/ui/SideImages";
import FeaturedCollection from "../../components/collections/FeaturedCollection";
import CollectionGrid from "../../components/collections/CollectionGrid";
import { useSeo } from "../../seo/useSeo";
import { itemListJsonLd } from "../../seo/jsonLd";

// مقادیر باید دقیقاً با نام فیلدهای واقعی مدل و کانوانسیون
// OrderingFilter در DRF همخوانی داشته باشند (پیشوند "-" برای نزولی)
const SORT_OPTIONS = [
  { value: "default", label: "پیش‌فرض" },
  { value: "title", label: "نام صعودی" },
  { value: "-title", label: "نام نزولی" },
  { value: "-items_count", label: "بیشترین تعداد فیلم" },
  { value: "items_count", label: "کمترین تعداد فیلم" },
];

export default function CollectionsPage() {
  const {
    collections,
    featuredCollection,
    loading,
    error,
    search,
    setSearch,
    sort,
    setSort,
    page,
    setPage,
    pagination,
  } = useCollections();

  useSeo({
    title: "کالکشن و مجموعه فیلم‌ها | مووی‌ورس",
    description:
      "بهترین کالکشن‌ها و مجموعه فیلم‌های سینمایی (فرنچایزها و سه‌گانه‌ها) برای دانلود و تماشای آنلاین با زیرنویس فارسی در مووی‌ورس.",
    path: "/collection",
    jsonLd: collections?.length
      ? itemListJsonLd({
          name: "کالکشن‌های مووی‌ورس",
          items: collections.slice(0, 20).map((c) => ({
            name: c.title || c.name,
            path: `/collection/${c.slug}`,
            image: c.cover || c.poster || c.image,
          })),
        })
      : undefined,
  });

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full overflow-x-hidden bg-gradient-to-b from-black to-[#08040d] text-white pt-28"
    >
      {/* <SideImages /> */}


      {/* Hero Section */}
      <section className="px-4 pt-12 pb-8 sm:px-6 md:pt-16 md:pb-10 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
            کالکشن‌ها
            <span className="mr-2 bg-gradient-to-l from-fuchsia-500 via-red-500 to-[#5c1a1f] bg-clip-text text-transparent">
              سینمایی
            </span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
            مجموعه‌ای منتخب از کالکشن‌های فیلم و سریال؛ از فرنچایزهای پرطرفدار
            تا مجموعه‌های کلاسیک، همه در یک‌جا کنار هم چیده شده‌اند.
          </p>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <StatCard
              label="تعداد کل کالکشن‌ها"
              value={pagination?.count ?? collections.length}
            />
            <StatCard label="نمایش داده‌شده" value={collections.length} />
            <StatCard
              label="شماره صفحه"
              value={`${page} از ${pagination?.totalPages ?? 1}`}
            />
          </div>
        </div>
      </section>

      {/* Search + Sort Panel */}
      <section className="px-4 pb-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:gap-4 sm:p-5">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
                aria-hidden="true"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجو در کالکشن‌ها..."
                className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pr-11 pl-4 text-sm text-white placeholder-white/40 outline-none transition-colors focus:border-fuchsia-500/60 focus:ring-2 focus:ring-fuchsia-500/20"
              />
            </div>

            <div className="relative sm:w-64">
              <SlidersHorizontal
                className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
                aria-hidden="true"
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="w-full appearance-none rounded-xl border border-white/10 bg-black/30 py-3 pr-11 pl-4 text-sm text-white outline-none transition-colors focus:border-fuchsia-500/60 focus:ring-2 focus:ring-fuchsia-500/20"
              >
                {SORT_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-[#08040d] text-white"
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Error Alert */}
      {error && (
        <section className="px-4 pb-8 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-gradient-to-l from-red-500/10 to-fuchsia-500/10 p-4 backdrop-blur-xl">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="text-sm font-semibold text-red-300">
                  خطا در دریافت اطلاعات
                </p>
                <p className="mt-1 text-sm text-white/60">
                  {typeof error === "string"
                    ? error
                    : "متأسفانه در بارگذاری کالکشن‌ها مشکلی پیش آمد. لطفاً دوباره تلاش کنید."}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Collections Grid */}
      <section className="px-4 pb-16 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <FeaturedCollection collection={featuredCollection} loading={loading} />
          <CollectionGrid
            collections={collections}
            loading={loading}
            page={page}
            setPage={setPage}
            pagination={pagination}
          />
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition-colors duration-300 hover:border-fuchsia-500/30">
      <p className="text-xs text-white/50">{label}</p>
      <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{value}</p>
    </div>
  );
}