import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Clapperboard,
  Calendar,
  Star,
} from "lucide-react";

export default function CollectionCard({ collection }) {
  const navigate = useNavigate();

const leftPoster =
  collection.items_preview?.[0]?.media?.poster_url
  // collection.poster_url;

const centerPoster =
collection.poster_url ||
  collection.items_preview?.[2]?.media?.poster_url ||
  collection.items_preview?.[0]?.media?.poster_url

const rightPoster =
  collection.items_preview?.[1]?.media?.poster_url
  // collection.poster_url;

  const backdrop = collection.backdrop_url || centerPoster || leftPoster;

    const collectionUrl = collection?.slug
      ? `/collection/${collection.slug}`
      : "/collection";


  return (
    <Link
      to={collectionUrl}
      className="
        min-w-72
        group
        relative
        overflow-hidden
        rounded-3xl
        border
        border-white/10
        bg-white/[0.045]
        shadow-card
        backdrop-blur-xl
        transition-all
        duration-500
        hover:-translate-y-2
        hover:border-rose-300/35
        hover:shadow-glow
        cursor-pointer
        xl:w-[400px]
        md:min-w-72
      "
    >
      {/* Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/0 via-transparent to-red-600/0 transition duration-500 group-hover:from-fuchsia-600/10 group-hover:to-red-600/10" />

      {/* ---------------- Posters ---------------- */}

      <div className="relative flex h-72 items-center justify-center overflow-hidden">

        {/* Background Blur */}
        <img
          src={backdrop}
          loading="lazy"
          decoding="async"
          alt=""
          className="
            absolute
            inset-0
            h-full
            w-full
            object-cover
            scale-110
            blur-[1px]
            opacity-20
          "
        />

        <div className="absolute inset-0 bg-gradient-to-t from-[#120709] via-[#120709]/20 to-transparent" />

        {/* Left Poster */}
        <img
          src={leftPoster}
          loading="lazy"
          decoding="async"
          alt=""
          className="
            absolute
            h-48
            w-32
            rounded-xl
            object-cover
            shadow-2xl
            -rotate-12
            -translate-x-20
            transition-all
            duration-500
            group-hover:-translate-x-28
            group-hover:-rotate-[18deg]
          "
        />

        {/* Center */}

        <img
          src={centerPoster}
          loading="lazy"
          decoding="async"
          alt={collection.title}
          className="
            relative
            z-20
            h-56
            w-36
            rounded-2xl
            object-cover
            shadow-[0_20px_40px_rgba(0,0,0,.5)]
            transition-all
            duration-500
            group-hover:scale-105
          "
        />

        {/* Right */}

        <img
          src={rightPoster}
          loading="lazy"
          decoding="async"
          alt=""
          className="
            absolute
            h-48
            w-32
            rounded-xl
            object-cover
            shadow-2xl
            rotate-12
            translate-x-20
            transition-all
            duration-500
            group-hover:translate-x-28
            group-hover:rotate-[18deg]
          "
        />
      </div>

      {/* ---------------- Body ---------------- */}

      <div className="relative space-y-5 p-6">

        <div dir="ltr" className="text-center">

          <div className="flex justify-between items-center">
            <h2 className="text-left line-clamp-2 text-xl font-bold text-white">
              {collection.title}
            </h2>
            <div className="w-20 gap-3 text-center rounded-xl border border-white/10 bg-black/20 p-3">

              <Clapperboard
                className=" mx-auto mb-2 text-fuchsia-400"
                size={18}
              />

              <div className="text-sm font-bold text-white">
                {collection.items_count}
              </div>

              <div className="mt-1 text-[11px] text-zinc-500">
                اثر
              </div>

            </div> 

          </div>

          <p className="mt-2 line-clamp-2 text-sm leading-7 text-zinc-400">
            {collection.description}
          </p>


        </div>

        {/* Stats */}

        {/* <div className="grid grid-cols-3 gap-3 text-center"> */}

          {/* <div className="rounded-xl border border-white/10 bg-black/20 p-3">

            <Calendar
              className="mx-auto mb-2 text-fuchsia-400"
              size={18}
            />

            <div className="text-sm font-bold text-white">

              {collection.first_year}

            </div>

            <div className="mt-1 text-[11px] text-zinc-500">

              شروع

            </div>

          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">

            <Star
              className="mx-auto mb-2 text-amber-400"
              fill="currentColor"
              size={18}
            />

            <div className="text-sm font-bold text-white">

              {collection.rating}

            </div>

            <div className="mt-1 text-[11px] text-zinc-500">

              امتیاز

            </div>

          </div> */}

        {/* </div> */}

        {/* Footer */}

        {/* <button
          className="
            flex
            w-full
            items-center
            justify-center
            gap-2
            rounded-2xl
            border
            border-fuchsia-500/20
            bg-gradient-to-r
            from-fuchsia-600/20
            to-red-600/20
            py-3
            font-semibold
            text-white
            transition
            duration-300
            group-hover:border-fuchsia-500/40
            group-hover:from-fuchsia-600
            group-hover:to-red-600
          "
        >

          مشاهده کالکشن

          <ArrowLeft
            size={18}
            className="transition group-hover:-translate-x-1"
          />

        </button> */}

        <div className="flex items-center justify-between border-t border-white/[0.07] pt-4" dir="rtl">
          <span className="text-sm font-bold text-zinc-100">مشاهده مجموعه</span>
          <span className="icon-btn h-9 w-9 group-hover:border-rose-300/50 group-hover:bg-rose-500/20">
            <ArrowLeft size={17} className="transition-transform duration-300 group-hover:-translate-x-0.5" />
          </span>
        </div>

      </div>

    </Link>
  );
}