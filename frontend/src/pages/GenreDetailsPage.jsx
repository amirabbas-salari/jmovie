import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Clapperboard,
  Tv,
  Sparkles,
  Search,
  SlidersHorizontal,
  Star,
  ChevronLeft,
} from "lucide-react";

import MediaCard from "../components/media/MediaCard";
import Pagination from "../components/ui/Pagination";
import SideImage from "../components/ui/SideImages";
import api from "../services/api";
import mapMedia from "../utils/mapMedia";

const PAGE_SIZE = 20;

function sortItems(items, sort) {
  const data = [...items];

  if (sort === "rating") {
    return data.sort(
      (a, b) => (b.rating || 0) - (a.rating || 0)
    );
  }

  if (sort === "oldest") {
    return data.sort(
      (a, b) => (a.year || 0) - (b.year || 0)
    );
  }

  if (sort === "title") {
    return data.sort((a, b) =>
      (a.title || "").localeCompare(
        b.title || "",
        "fa"
      )
    );
  }

  return data.sort(
    (a, b) =>
      (b.year || 0) - (a.year || 0)
  );
}


export default function GenreDetailsPage() {

  const { slug } = useParams();

  const [genreData, setGenreData] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(null);


  const [tab, setTab] =
    useState("all");

  const [search, setSearch] =
    useState("");

  const [sort, setSort] =
    useState("newest");


  const [page, setPage] =
    useState(1);



  useEffect(() => {

    const controller = new AbortController();

    setLoading(true);
    setError(null);

    api
      .get(`/genres/${slug}/`, { signal: controller.signal })
      .then(({ data }) => {

        // فیلم‌ها و سریال‌های ژانر با mapMedia نرمال‌سازی می‌شوند
        // و مشخص می‌شود که هر آیتم فیلم است یا سریال (mediaType)
        const movies = (data.movies || [])
          .map(mapMedia)
          .map((item) => ({ ...item, mediaType: "movie" }));

        const series = (data.series || [])
          .map(mapMedia)
          .map((item) => ({ ...item, mediaType: "series" }));

        const results = [...movies, ...series];

        // چون بک‌اند فعلاً "محبوب‌ترین‌ها" جداگانه‌ای برنمی‌گرداند،
        // به‌عنوان جایگزین، ۵ آیتم با بالاترین امتیاز را نمایش می‌دهیم
        const trending = [...results]
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))
          .slice(0, 5);

        setGenreData({
          genre: {
            name: data.name,
            slug: data.slug,
          },
          results,
          trending,
          moviesCount: movies.length,
          seriesCount: series.length,
        });
      })
      .catch((err) => {
        if (err.name === "CanceledError" || err.code === "ERR_CANCELED") {
          return;
        }
        setError(
          err?.response?.data?.detail ?? "ژانر مورد نظر پیدا نشد."
        );
      })
      .finally(() => setLoading(false));

    return () => controller.abort();

  }, [slug]);


  /*
   * هنگام تغییر فیلترها
   * صفحه به ۱ برگردد.
   */
  useEffect(() => {
    setPage(1);
  }, [tab, search, sort]);


  const filteredItems =
    useMemo(() => {

      if (!genreData)
        return [];


      let items =
        [...genreData.results];


      if(tab === "movies"){
        items =
          items.filter(
            item =>
              item.mediaType === "movie"
          );
      }


      if(tab === "series"){
        items =
          items.filter(
            item =>
              item.mediaType === "series"
          );
      }


      if(search.trim()){

        const q =
          search.toLowerCase();


        items =
          items.filter(
            item =>
              (item.title || "")
                .toLowerCase()
                .includes(q)
          );
      }


      return sortItems(
        items,
        sort
      );


    },[
      genreData,
      tab,
      search,
      sort
    ]);


  // چون بک‌اند pagination ندارد و کل لیست را یک‌جا برمی‌گرداند،
  // صفحه‌بندی اینجا سمت کلاینت روی آرایه‌ی فیلترشده انجام می‌شود
  const totalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / PAGE_SIZE)
  );

  const pageItems = useMemo(
    () =>
      filteredItems.slice(
        (page - 1) * PAGE_SIZE,
        page * PAGE_SIZE
      ),
    [filteredItems, page]
  );


  const genre =
    genreData?.genre;



  return (
    <div
      dir="rtl"
      className="
      min-h-screen
      bg-gradient-to-b
      from-black
      via-[#100708]
      to-[#08040d]
      px-4
      pb-12
      sm:px-6
      lg:px-8
      pt-20 
      "
    >

      {/* <SideImage /> */}


      <div
        className="
        pointer-events-none
        fixed
        -right-32
        top-20
        h-96
        w-96
        rounded-full
        bg-fuchsia-600/20
        blur-3xl
        "
      />


      <div
        className="
        mx-auto
        max-w-7xl
        pt-24
        "
      >


        <section
          className="
          relative
          overflow-hidden
          rounded-3xl
          border
          border-white/10
          bg-white/[0.05]
          backdrop-blur-xl
          "
        >

          <div
            className="
            relative
            z-10
            p-6
            sm:p-10
            "
          >

            <span
              className="
              inline-flex
              items-center
              gap-2
              rounded-full
              border
              border-white/10
              bg-white/5
              px-4
              py-2
              text-xs
              text-white/70
              "
            >
              <Sparkles size={15}/>
              ژانر اختصاصی
            </span>


            <h1
              className="
              mt-5
              text-3xl
              font-black
              text-white
              sm:text-5xl
              "
            >
              {genre?.name}
            </h1>


            <div
              className="
              mt-8
              grid
              grid-cols-2
              gap-3
              sm:grid-cols-3
              "
            >

              <InfoBox
                icon={<Clapperboard size={18}/>}
                title="فیلم"
                value={genreData?.moviesCount ?? 0}
              />

              <InfoBox
                icon={<Tv size={18}/>}
                title="سریال"
                value={genreData?.seriesCount ?? 0}
              />

              <InfoBox
                icon={<Sparkles size={18}/>}
                title="مجموع"
                value={
                  (genreData?.moviesCount || 0)
                  +
                  (genreData?.seriesCount || 0)
                }
              />

            </div>


          </div>

        </section>



        {/* Trending */}

        {!loading &&
          genreData?.trending?.length > 0 && (

          <section
            className="
            mt-10
            "
          >

            <div
              className="
              mb-5
              flex
              items-center
              justify-between
              "
            >

              <div>

                <h2
                  className="
                  text-xl
                  font-bold
                  text-white
                  sm:text-2xl
                  "
                >
                  محبوب‌ترین‌های این ژانر
                </h2>


                <p
                  className="
                  mt-1
                  text-sm
                  text-white/50
                  "
                >
                  بر اساس بالاترین امتیاز
                </p>

              </div>

            </div>



            <div
              className="
              flex
              gap-4
              overflow-x-auto
              pb-3
              scrollbar-hide
              "
            >

              {
                genreData.trending.map(
                  item => (

                  <div
                    key={item.slug}
                    className="
                    group
                    min-w-[180px]
                    overflow-hidden
                    rounded-3xl
                    border
                    border-white/10
                    bg-white/[0.04]
                    backdrop-blur
                    "
                  >

                    <div
                      className="
                      relative
                      aspect-[2/3]
                      overflow-hidden
                      "
                    >

                      <img
                        src={item.poster}
                        alt={item.title}
                        className="
                        h-full
                        w-full
                        object-cover
                        transition
                        duration-500
                        group-hover:scale-110
                        "
                      />


                      <div
                        className="
                        absolute
                        inset-0
                        bg-gradient-to-t
                        from-black
                        via-transparent
                        "
                      />


                      <div
                        className="
                        absolute
                        bottom-3
                        left-3
                        flex
                        items-center
                        gap-1
                        rounded-full
                        bg-black/60
                        px-3
                        py-1
                        text-xs
                        text-yellow-400
                        "
                      >

                        <Star
                          size={13}
                          fill="currentColor"
                        />

                        {item.rating}

                      </div>


                    </div>



                    <div
                      className="
                      p-3
                      "
                    >

                      <h3
                        className="
                        truncate
                        text-sm
                        font-bold
                        text-white
                        "
                      >
                        {item.title}
                      </h3>


                      <p
                        className="
                        mt-1
                        text-xs
                        text-white/50
                        "
                      >
                        {item.year}
                      </p>

                    </div>


                  </div>

                ))
              }


            </div>


          </section>

        )}




        {/* Filters */}

        <section
          className="
          mt-10
          rounded-3xl
          border
          border-white/10
          bg-white/[0.04]
          p-4
          backdrop-blur-xl
          "
        >


          <div
            className="
            flex
            flex-col
            gap-4
            lg:flex-row
            lg:items-center
            lg:justify-between
            "
          >



            <div
              className="
              flex
              flex-wrap
              gap-2
              "
            >

              {
                [
                  ["all","همه"],
                  ["movies","فیلم‌ها"],
                  ["series","سریال‌ها"],
                ]
                .map(([key,label])=>(

                  <button
                    key={key}
                    onClick={()=>{
                      setTab(key);
                      setPage(1);
                    }}
                    className={` rounded-2xl px-5 py-2.5 text-sm transition ${ tab===key ? " bg-fuchsia-600/30 border border-fuchsia-400/30 text-white " : " border border-white/10 bg-white/5 text-white/60 " } `}
                  >
                    {label}
                  </button>

                ))
              }


            </div>




            <div
              className="
              flex
              flex-col
              gap-3
              sm:flex-row
              "
            >


              <div
                className="
                relative
                "
              >

                <Search
                  size={17}
                  className="
                  absolute
                  right-3
                  top-1/2
                  -translate-y-1/2
                  text-white/40
                  "
                />


                <input
                  value={search}
                  onChange={
                    e=>setSearch(e.target.value)
                  }
                  placeholder="جستجو..."
                  className="
                  h-11
                  rounded-2xl
                  border
                  border-white/10
                  bg-black/20
                  pr-10
                  pl-4
                  text-sm
                  text-white
                  outline-none
                  placeholder:text-white/30
                  "
                />

              </div>



              <div
                className="
                relative
                "
              >

                <SlidersHorizontal
                  size={17}
                  className="
                  absolute
                  right-3
                  top-1/2
                  -translate-y-1/2
                  text-white/40
                  "
                />

                <select
                  value={sort}
                  onChange={
                    e=>setSort(e.target.value)
                  }
                  className="
                  h-11
                  rounded-2xl
                  border
                  border-white/10
                  bg-black/20
                  pr-10
                  pl-5
                  text-sm
                  text-white
                  outline-none
                  "
                >

                  <option value="newest">
                    جدیدترین
                  </option>

                  <option value="rating">
                    بالاترین امتیاز
                  </option>

                  <option value="oldest">
                    قدیمی‌ترین
                  </option>

                  <option value="title">
                    الفبا
                  </option>

                </select>


              </div>


            </div>


          </div>


        </section>

        {/* Content Grid */}

        {error && (
          <div
            className="
            mt-8
            rounded-2xl
            border
            border-red-500/30
            bg-red-500/10
            p-4
            text-center
            text-sm
            text-red-300
            "
          >
            {error}
          </div>
        )}



        {loading ? (

          <div
            className="
            mt-8
            grid
            grid-cols-2
            gap-4
            sm:grid-cols-3
            md:grid-cols-4
            lg:grid-cols-5
            "
          >

            {
              Array
              .from({length:10})
              .map((_,index)=>(

                <div
                  key={index}
                  className="
                  aspect-[2/3]
                  animate-pulse
                  rounded-3xl
                  bg-white/5
                  "
                />

              ))
            }

          </div>


        ) : filteredItems.length === 0 ? (


          <div
            className="
            mt-8
            rounded-3xl
            border
            border-white/10
            bg-white/5
            py-16
            text-center
            text-white/50
            "
          >

            نتیجه‌ای پیدا نشد.

          </div>



        ) : (


          <div
            className="
            mt-8
            grid
            grid-cols-2
            gap-4
            sm:grid-cols-3
            md:grid-cols-4
            lg:grid-cols-5
            "
          >

            {
              pageItems.map(item=>(

                <MediaCard
                  key={item.slug}
                  media={item}
                  type={
                    item.mediaType === "series"
                    ? "series"
                    : "movie"
                  }
                />

              ))
            }


          </div>


        )}




        {
          !loading &&
          filteredItems.length > 0 && (

            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={setPage}
            />

          )
        }



      </div>

    </div>
  );
}




function InfoBox({
  icon,
  title,
  value,
}) {

  return (

    <div
      className="
      flex
      items-center
      gap-3
      rounded-2xl
      border
      border-white/10
      bg-black/20
      p-4
      "
    >

      <div
        className="
        grid
        h-10
        w-10
        place-items-center
        rounded-xl
        bg-white/10
        text-white
        "
      >
        {icon}
      </div>


      <div>

        <p
          className="
          text-xs
          text-white/50
          "
        >
          {title}
        </p>


        <p
          className="
          mt-1
          text-lg
          font-bold
          text-white
          "
        >
          {value}
        </p>

      </div>


    </div>

  );

}