import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Calendar,
  User,
  Film,
  Globe,
  ChevronLeft,
  ChevronRight,
  Trash2,
  SlidersHorizontal, // آیکون برای دکمه فیلتر موبایل
  X, // آیکون بستن مودال
  ChevronDown,
} from "lucide-react";

import api from "../../services/api";

// لیست کشورها با مقدار واقعی (کد) که باید به API ارسال شود
// در صورت امکان بهتر است این لیست هم مثل ژانرها از بک‌اند دریافت شود
const COUNTRIES = [
  { label: "ایران", value: "IR" },
  { label: "آمریکا", value: "US" },
  { label: "انگلیس", value: "GB" },
  { label: "کره جنوبی", value: "KR" },
  { label: "فرانسه", value: "FR" },
];

const DEFAULT_FILTERS = {
  query: "",
  year: "",
  country: "",
  actor: "",
  director: "",
  genres: [],
};

export default function AdvanceSearch({
  filters,
  onChange,
  onApply,
}) {
  const [showAdvancedDesktop, setShowAdvancedDesktop] = useState(false);
  const scrollRef = useRef(null);
  const [genres, setGenres] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false); // کنترل باز و بسته شدن پنجره در موبایل

  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentYear - 1899 },
    (_, i) => currentYear - i
  );

  useEffect(() => {
    const loadGenres = async () => {
      try {
        const res = await api.get("/genres/");
        setGenres(res.data.results || res.data);
      } catch (e) {
        console.log(e);
      }
    };
    loadGenres();
  }, []);

  const toggleGenre = (slug) => {
    const current = filters.genres || [];
    const updated = current.includes(slug)
      ? current.filter((g) => g !== slug)
      : [...current, slug];

    onChange({ genres: updated });
  };

  // پاک کردن فیلترها و اعمال فوری آن‌ها (بدون این کار، لیست نتایج تا کلیک بعدی روی "جستجو" تغییر نمی‌کرد)
  const clearFilters = () => {
    onChange(DEFAULT_FILTERS);
    onApply(DEFAULT_FILTERS);
  };

  const scroll = (dir) => {
    scrollRef.current?.scrollBy({
      left: dir === "next" ? 250 : -250,
      behavior: "smooth",
    });
  };

  // تابع کمکی برای دکمه اعمال فیلتر در مودال موبایل
  const handleApplyMobile = () => {
    onApply(filters);
    setIsModalOpen(false); // بستن پنجره بعد از اعمال
  };

  return (

    <div dir="rtl" className="w-full">

      {/* ==================== موبایل ==================== */}

      <div className="lg:hidden flex items-center gap-2 rounded-2xl bg-[#0d1628]/70 border border-cyan-500/20 backdrop-blur-xl p-2">

        <div className="relative flex-1">

          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400"
          />

          <input
            type="text"
            value={filters.query || ""}
            onChange={(e) => onChange({ query: e.target.value })}
            placeholder="جستجوی فیلم و سریال..."
            className="
        w-full
        rounded-xl
        bg-[#0f172a]
        border
        border-cyan-500/20
        py-3
        pr-4
        pl-10
        text-white
        placeholder:text-gray-500
        outline-none
        focus:border-cyan-400
        transition
        "
          />

        </div>

        <button

          onClick={() => setIsModalOpen(true)}

          className="
      p-3
      rounded-xl
      border
      border-cyan-500/30
      bg-cyan-500/10
      text-cyan-400
      hover:bg-cyan-500
      hover:text-white
      duration-300
      "

        >

          <SlidersHorizontal size={20} />

        </button>

        <button

          onClick={() => onApply(filters)}

          className="
      rounded-xl
      px-5
      py-3
      font-bold
      text-white
      bg-gradient-to-r
      from-cyan-500
      to-violet-600
      "

        >

          جستجو

        </button>

      </div>


      {/* ==================== دسکتاپ ==================== */}

      <div className="hidden lg:block">

        <div

          className="
      flex
      items-center
      gap-3
      rounded-[28px]
      border
      border-cyan-500/20
      bg-[#0d1628]/70
      backdrop-blur-xl
      p-3
      shadow-[0_0_30px_rgba(34,211,238,.08)]
      "

        >

          <div className="relative flex-1">

            <Search

              size={20}

              className="
          absolute
          left-4
          top-1/2
          -translate-y-1/2
          text-cyan-400
          "

            />

            <input

              type="text"

              value={filters.query || ""}

              onChange={(e) => onChange({ query: e.target.value })}

              placeholder="جستجوی فیلم، سریال، بازیگر..."

              className="
          w-full
          rounded-2xl
          bg-[#0f172a]
          border
          border-cyan-500/20
          py-3
          pr-5
          pl-10
          text-white
          placeholder:text-gray-500
          outline-none
          focus:ring-2
          focus:ring-cyan-500/20
          focus:border-cyan-400
          "

            />

          </div>

          <button

            onClick={() => setShowAdvancedDesktop(!showAdvancedDesktop)}

            className="
        flex
        items-center
        gap-2
        rounded-2xl
        px-5
        py-3
        border
        border-cyan-500/20
        bg-cyan-500/10
        text-cyan-300
        hover:bg-cyan-500
        hover:text-white
        duration-300
        "

          >

            فیلترهای پیشرفته

            <ChevronDown

              size={18}

              className={`
          duration-300
          ${showAdvancedDesktop
                  ? "rotate-180"
                  : ""
                }
          `}

            />

          </button>

          <button

            onClick={() => onApply(filters)}

            className="
        rounded-2xl
        px-7
        py-3
        font-bold
        text-white
        bg-gradient-to-r
        from-cyan-500
        to-violet-600
        hover:scale-105
        duration-300
        "

          >

            جستجو

          </button>

        </div>


        {/* پنل بازشونده */}

        <div

          className={`
      overflow-hidden
      transition-all
      duration-500

      ${showAdvancedDesktop
              ?
              "max-h-[2000px] opacity-100 mt-6"
              :
              "max-h-0 opacity-0"
            }

      `}

        >

          <section

            className="
        rounded-[35px]
        border
        border-cyan-500/20
        bg-gradient-to-br
        from-[#09111f]
        via-[#0d1628]
        to-[#08111e]
        backdrop-blur-xl
        shadow-[0_0_45px_rgba(34,211,238,.12)]
        p-8
        "

          >

            <div className="grid xl:grid-cols-12 gap-8">

              {/* تصویر */}

              <div

                className="
            hidden
            xl:flex
            xl:col-span-3
            flex-col
            items-center
            justify-center
            "

              >

                <img

                  src="/camera.webp"

                  alt="camera"

                  className="
              w-56
              drop-shadow-[0_0_40px_rgba(34,211,238,.4)]
              hover:scale-105
              duration-500
              "

                />

                <h3 className="text-white text-xl font-bold mt-5">

                  فیلم و سریال

                </h3>

                <p className="text-gray-400 text-center mt-2 leading-7">

                  فیلم و سریال مورد علاقه خود را
                  سریع‌تر پیدا کنید

                </p>

              </div>

              <div className="col-span-12 xl:col-span-9">
                {/* عنوان */}

                <div className="mb-8">

                  <h2 className="text-2xl font-bold text-white">

                    جستجوی پیشرفته

                  </h2>

                  <p className="mt-2 text-gray-400 text-sm">

                    با استفاده از فیلترهای زیر سریع‌تر فیلم و سریال مورد علاقه خود را پیدا کنید.

                  </p>

                </div>


                {/* فرم */}

                <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">


                  {/* سال انتشار */}

                  <div>

                    <label className="block mb-2 text-sm text-gray-300">

                      سال انتشار

                    </label>

                    <div className="relative">

                      <Calendar
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400"
                      />

                      <select

                        value={filters.year || ""}

                        onChange={(e) => onChange({ year: e.target.value })}

                        className="
                w-full
                rounded-2xl
                bg-[#0f172a]
                border
                border-cyan-500/20
                py-3
                pr-4
                pl-10
                text-white
                outline-none
                focus:border-cyan-400
                "

                      >

                        <option value="">

                          همه سال‌ها

                        </option>

                        {

                          years.map((y) => (

                            <option key={y} value={y}>

                              {y}

                            </option>

                          ))

                        }

                      </select>

                    </div>

                  </div>


                  {/* کشور */}

                  <div>

                    <label className="block mb-2 text-sm text-gray-300">

                      کشور

                    </label>

                    <div className="relative">

                      <Globe

                        size={18}

                        className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400"

                      />

                      <select

                        value={filters.country || ""}

                        onChange={(e) => onChange({ country: e.target.value })}

                        className="
                w-full
                rounded-2xl
                bg-[#0f172a]
                border
                border-cyan-500/20
                py-3
                pr-4
                pl-10
                text-white
                outline-none
                "

                      >

                        <option value="">

                          همه کشورها

                        </option>

                        {

                          COUNTRIES.map((c) => (

                            <option key={c.value} value={c.value}>

                              {c.label}

                            </option>

                          ))

                        }

                      </select>

                    </div>

                  </div>


                  {/* بازیگر */}

                  <div>

                    <label className="block mb-2 text-sm text-gray-300">

                      بازیگر

                    </label>

                    <div className="relative">

                      <User

                        size={18}

                        className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400"

                      />

                      <input

                        type="text"

                        value={filters.actor || ""}

                        onChange={(e) => onChange({ actor: e.target.value })}

                        placeholder="نام بازیگر..."

                        className="
                w-full
                rounded-2xl
                bg-[#0f172a]
                border
                border-cyan-500/20
                py-3
                pr-4
                pl-10
                text-white
                outline-none
                "

                      />

                    </div>

                  </div>


                  {/* کارگردان (قبلاً فقط در نسخه موبایل بود، اینجا اضافه شد) */}

                  <div>

                    <label className="block mb-2 text-sm text-gray-300">

                      کارگردان

                    </label>

                    <div className="relative">

                      <Film

                        size={18}

                        className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400"

                      />

                      <input

                        type="text"

                        value={filters.director || ""}

                        onChange={(e) => onChange({ director: e.target.value })}

                        placeholder="نام کارگردان..."

                        className="
                w-full
                rounded-2xl
                bg-[#0f172a]
                border
                border-cyan-500/20
                py-3
                pr-4
                pl-10
                text-white
                outline-none
                "

                      />

                    </div>

                  </div>

                </div>


                {/* ژانرها */}

                <div className="mt-8 pt-6 border-t border-cyan-900/40">

                  <h3 className="text-white font-bold mb-4">

                    ژانرها

                  </h3>

                  <div className="flex flex-wrap gap-3">

                    {

                      genres.map((genre) => {

                        const active =

                          filters.genres?.includes(genre.slug);

                        return (

                          <button

                            key={genre.id}

                            onClick={() => toggleGenre(genre.slug)}

                            className={`

                        px-5
                        py-2
                        rounded-full
                        border
                        duration-300

                        ${active

                                ?

                                "bg-gradient-to-r from-pink-500 to-pink-600 text-white border-transparent shadow-[0_0_20px_rgba(236,72,153,.35)]"

                                :

                                "bg-[#101828] border-pink-500/20 text-gray-300 hover:bg-pink-500/10 hover:border-pink-500"

                              }

                        `}

                          >

                            {genre.name}

                          </button>

                        )

                      })

                    }

                  </div>

                </div>
                {/* ====================== فوتر ====================== */}

                <div className="mt-8 pt-6 border-t border-cyan-900/40 flex items-center justify-between flex-wrap gap-4">

                  <div className="flex gap-3">

                    <button

                      onClick={clearFilters}

                      className="
            rounded-2xl
            px-5
            py-3
            border
            border-red-500/20
            bg-red-500/10
            text-red-300
            hover:bg-red-500
            hover:text-white
            duration-300
            flex
            items-center
            gap-2
            "

                    >

                      <Trash2 size={18} />

                      پاک کردن فیلترها

                    </button>

                    <button

                      onClick={() => onApply(filters)}

                      className="
            rounded-2xl
            px-8
            py-3
            font-bold
            text-white
            bg-gradient-to-r
            from-cyan-500
            to-violet-600
            hover:scale-105
            duration-300
            shadow-[0_0_30px_rgba(34,211,238,.25)]
            "

                    >

                      اعمال فیلترها

                    </button>

                  </div>

                  <div className="text-gray-400 text-sm">

                    {

                      filters.genres?.length > 0 &&

                      <span>

                        {filters.genres.length}

                        {" "}

                        ژانر انتخاب شده

                      </span>

                    }

                  </div>

                </div>

              </div>

            </div>

          </section>

        </div>

      </div>


      {/* ====================== مودال موبایل ====================== */}

      {

        isModalOpen && (

          <div

            className="
fixed
inset-0
z-50
bg-black/80
backdrop-blur-md
flex
items-center
justify-center
p-4
lg:hidden
"

          >

            <div

              className="
relative
w-full
max-w-lg
max-h-[90vh]
overflow-y-auto
rounded-3xl
border
border-cyan-500/20
bg-gradient-to-br
from-[#09111f]
via-[#0d1628]
to-[#08111e]
p-5
"

            >

              <button

                onClick={() => setIsModalOpen(false)}

                className="
absolute
top-4
left-4
p-2
rounded-xl
bg-white/5
text-gray-400
hover:text-white
"

              >

                <X size={20} />

              </button>

              <h2 className="text-white text-xl font-bold mb-6">

                جستجوی پیشرفته

              </h2>

              <div className="space-y-4">

                <input

                  type="text"

                  value={filters.query || ""}

                  onChange={(e) => onChange({ query: e.target.value })}

                  placeholder="نام فیلم یا سریال..."

                  className="
w-full
rounded-xl
bg-[#0f172a]
border
border-cyan-500/20
py-3
px-4
text-white
outline-none
"

                />

                <select

                  value={filters.year || ""}

                  onChange={(e) => onChange({ year: e.target.value })}

                  className="
w-full
rounded-xl
bg-[#0f172a]
border
border-cyan-500/20
py-3
px-4
text-white
"

                >

                  <option value="">

                    همه سال‌ها

                  </option>

                  {

                    years.map(y =>

                      <option key={y} value={y}>

                        {y}

                      </option>

                    )

                  }

                </select>

                {/* کشور در نسخه موبایل هم اضافه شد تا با دسکتاپ یکسان باشد */}

                <select

                  value={filters.country || ""}

                  onChange={(e) => onChange({ country: e.target.value })}

                  className="
w-full
rounded-xl
bg-[#0f172a]
border
border-cyan-500/20
py-3
px-4
text-white
"

                >

                  <option value="">

                    همه کشورها

                  </option>

                  {

                    COUNTRIES.map((c) => (

                      <option key={c.value} value={c.value}>

                        {c.label}

                      </option>

                    ))

                  }

                </select>

                <input

                  type="text"

                  value={filters.actor || ""}

                  onChange={(e) => onChange({ actor: e.target.value })}

                  placeholder="نام بازیگر"

                  className="
w-full
rounded-xl
bg-[#0f172a]
border
border-cyan-500/20
py-3
px-4
text-white
"

                />

                <input

                  type="text"

                  value={filters.director || ""}

                  onChange={(e) => onChange({ director: e.target.value })}

                  placeholder="نام کارگردان"

                  className="
w-full
rounded-xl
bg-[#0f172a]
border
border-cyan-500/20
py-3
px-4
text-white
"

                />

                <div className="pt-3">

                  <h3 className="text-white mb-3">

                    ژانرها

                  </h3>

                  <div className="flex flex-wrap gap-2">

                    {

                      genres.map((genre) => {

                        const active =

                          filters.genres?.includes(genre.slug);

                        return (

                          <button

                            key={genre.id}

                            onClick={() => toggleGenre(genre.slug)}

                            className={`

px-4

py-2

rounded-full

border

text-sm

${active

                                ?

                                "bg-pink-500 border-pink-500 text-white"

                                :

                                "border-pink-500/20 text-gray-300"

                              }

`}

                          >

                            {genre.name}

                          </button>

                        )

                      })

                    }

                  </div>

                </div>

                <div className="pt-5 flex flex-col gap-2">

                  <button

                    onClick={handleApplyMobile}

                    className="
w-full
rounded-xl
py-3
font-bold
text-white
bg-gradient-to-r
from-cyan-500
to-violet-600
"

                  >

                    اعمال فیلترها

                  </button>

                  <button

                    onClick={() => {

                      clearFilters();

                      setIsModalOpen(false);

                    }}

                    className="
w-full
rounded-xl
py-3
border
border-red-500/20
bg-red-500/10
text-red-300
"

                  >

                    پاک کردن فیلترها

                  </button>

                </div>

              </div>

            </div>

          </div>

        )

      }

    </div>

  );
}