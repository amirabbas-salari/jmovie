import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { backdropImage, backdropSrcSet, posterImage } from "../../utils/image";
import { FiInfo, FiPlay } from "react-icons/fi";
import { DetailListActions } from "../media/ListActions";

// تبدیل دقیقه به فرمت "۱h ۳۰m"
const formatRuntime = (min) => {
  if (!min || min <= 0) return null;

  const h = Math.floor(min / 60);
  const m = min % 60;

  return [h ? `${h}h` : "", m ? `${m}m` : ""]
    .filter(Boolean)
    .join(" ");
};

// خلاصه‌سازی بازدید
const formatViews = (n) => {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n ?? 0);
};

const HeroSection = ({
  movies = [],
  interval = 6000,
}) => {
  const navigate = useNavigate();

  const [active, setActive] = useState(0);
  const [fade, setFade] = useState(true);
  const [paused, setPaused] = useState(false);

  const activeRef = useRef(0);

  const total = movies.length;

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const goTo = useCallback(
    (index) => {
      if (!total) return;

      setFade(false);

      setTimeout(() => {
        setActive(
          ((index % total) + total) % total
        );

        setFade(true);
      }, 300);
    },
    [total]
  );

  useEffect(() => {
    if (total <= 1 || paused) return;

    const timer = setInterval(() => {
      goTo(activeRef.current + 1);
    }, interval);

    return () => clearInterval(timer);
  }, [
    total,
    interval,
    paused,
    goTo,
  ]);

  if (!total) return null;

  const main = movies[active];

  const bg =
    main.backdrop_url || main.poster_url;

  const runtime = formatRuntime(
    main.runtime
  );

  const stacked = [1, 2, 3].map(
    (o) =>
      movies[
        (active + o) % total
      ]
  );

  return (
    <section
      dir="ltr"
      onMouseEnter={() =>
        setPaused(true)
      }
      onMouseLeave={() =>
        setPaused(false)
      }
      className="
        relative
        w-full
        min-h-screen
        lg:h-screen
        overflow-hidden
        bg-ink
        select-none
      "
    >
      {/* BG */}
      <div
        key={main.id}
        className={`
          absolute
          inset-0
          transition-opacity
          duration-700
          ${
            fade
              ? "opacity-100"
              : "opacity-0"
          }
        `}
      >
        <img
          src={backdropImage(bg)}
          srcSet={backdropSrcSet(bg)}
          sizes="100vw"
          alt={main.title}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="
            h-full
            w-full
            object-cover
            motion-safe:lg:animate-ken-burns
          "
        />
      </div>

      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/40" />
      <div className="pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-fuchsia-600/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-[15%] h-64 w-64 rounded-full bg-rose-600/15 blur-3xl" />

      <div
        className="
          relative
          z-10
          flex
          flex-col
          lg:flex-row

          justify-end
          lg:justify-between

          items-start
          lg:items-end

          min-h-screen

          pt-32
          sm:pt-36
          lg:pt-0

          px-5
          sm:px-[7%]

          pb-16
          sm:pb-20

          gap-10
        "
      >
        {/* LEFT */}
        <div
          className={`
            w-full
            max-w-full
            sm:max-w-xl
            transition-all
            duration-500
            ${
              fade
                ? "opacity-100"
                : "opacity-0 translate-y-6"
            }
          `}
        >
          <div dir="rtl" className="mb-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-3.5 py-1.5 text-[11px] font-black text-white shadow-glow-sm sm:text-xs">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              پیشنهاد امروز
            </span>
            <span className="chip">
              {main.type === "series" ? "سریال" : "فیلم"}
            </span>
            {main.year && <span className="chip">{main.year}</span>}
          </div>

          <h1
            className="
              text-white
              text-3xl
              sm:text-5xl
              lg:text-6xl
              font-black
              leading-tight
              drop-shadow-2xl
              [text-wrap:balance]
              mb-2
            "
          >
            {main.original_title}
          </h1>

          <p className="text-gray-400 text-xs sm:text-sm italic mb-4">
            {main.title}
          </p>

          {/* META */}
          <div
            className="
              flex
              flex-wrap
              items-center
              gap-x-4
              gap-y-2
              mb-5
              text-xs
              sm:text-sm
            "
          >
            <span className="flex items-center gap-1.5">
              <span className="bg-yellow-400 text-black text-[10px] font-black px-1.5 py-0.5 rounded">
                IMDb
              </span>

              <span className="text-white">
                {main.imdb_rating}
              </span>
            </span>

            {main.release_date && (
              <span className="text-gray-300">
                {String(
                  main.release_date
                ).slice(0, 4)}
              </span>
            )}

            {runtime && (
              <span className="text-gray-300">
                {runtime}
              </span>
            )}

            <span className="text-gray-400">
              👁{" "}
              {formatViews(
                main.views
              )}
            </span>
          </div>

          {/* TAGS */}
          <div className="mb-5 flex flex-wrap gap-2">
            {main.genres?.slice(0, 3).map((g) => (
              <Link
                key={g.id || g.slug || g.name}
                to={`/genre/${g.slug}`}
                className="
                  group inline-flex items-center rounded-full
                  border border-white/10 bg-white/10
                  px-3 py-1 text-[10px] text-rose-100
                  backdrop-blur-md transition-all duration-200
                  hover:-translate-y-0.5 hover:border-rose-300/40
                  hover:bg-rose-500/20 hover:text-white
                  sm:text-[11px]
                "
              >
                <span>{g.name}</span>
              </Link>
            ))}
          </div>

          {/* DESC */}
          {main.description && (
            <p
              dir="rtl"
              className="
                text-gray-300
                text-xs
                sm:text-sm
                leading-relaxed
                mb-7
                line-clamp-4
                max-w-full
                sm:max-w-lg
              "
            >
              {main.description}
            </p>
          )}

          {/* ACTIONS */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <button
              onClick={() =>
                navigate(
                  `/${main.type || "movie"}/${main.slug}`
                )
              }
              // className="
              //   w-full
              //   sm:w-auto
              //   flex
              //   justify-center
              //   items-center
              //   gap-2
              //   bg-rose-500
              //   hover:bg-[#9333ea]
              //   text-white
              //   px-6
              //   py-3
              //   rounded-full
              //   transition
              // "

              className="btn-brand group relative flex-1 overflow-hidden px-5 py-3 text-sm sm:flex-none sm:px-7 sm:py-3.5 sm:text-base"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r
                from-transparent via-white/25 to-transparent
                transition-transform duration-700 group-hover:translate-x-full" />
              <FiPlay className="fill-current" />
              تماشا و جزئیات
            </button>

            <button
              onClick={() =>
                navigate(
                  `/${main.type || "movie"}/${main.slug}`
                )
              }
              className="btn-ghost flex-1 px-6 py-3 text-sm sm:flex-none sm:text-base"
            >
              <FiInfo />
              اطلاعات بیشتر
            </button>

            <DetailListActions mediaId={main.id} type={main.type || "movie"} />
          </div>
        </div>

        {/* RIGHT */}
        <div className="hidden lg:flex relative items-end h-72 w-96 shrink-0">
          {stacked[0] && (
            <PosterCard
              movie={stacked[0]}
              onClick={() =>
                goTo(
                  active + 1
                )
              }
              className="
                absolute
                left-0
                bottom-0
                w-32
                h-48
                -rotate-6
              "
            />
          )}

          {stacked[1] && (
            <PosterCard
              movie={stacked[1]}
              onClick={() =>
                goTo(
                  active + 2
                )
              }
              className="
                absolute
                left-1/2
                -translate-x-1/2
                w-40
                h-56
                z-10
              "
            />
          )}

          {stacked[2] && (
            <PosterCard
              movie={stacked[2]}
              onClick={() =>
                goTo(
                  active + 3
                )
              }
              className="
                absolute
                right-0
                w-32
                h-48
                rotate-6
              "
            />
          )}
        </div>
      </div>

      {/* DOTS */}
      <div
        className="
          absolute
          bottom-5
          left-1/2
          -translate-x-1/2
          lg:left-[7%]
          lg:translate-x-0
          flex
          gap-2
        "
      >
        {movies.map(
          (
            movie,
            i
          ) => (
            <button
              key={
                movie.id
              }
              onClick={() =>
                goTo(i)
              }
              className={`
                h-1.5
                rounded-full
                transition-all
                ${
                  i === active
                    ? "w-11 bg-brand-gradient shadow-glow-sm"
                    : "w-3 bg-white/30 hover:bg-white/60"
                }
              `}
            />
          )
        )}
      </div>
    </section>
  );
};

const PosterCard = ({
  movie,
  onClick,
  className,
}) => (
  <button
    onClick={onClick}
    className={`
      overflow-hidden
      rounded-2xl
      shadow-2xl
      transition
      hover:scale-105
      ${className}
    `}
  >
    <img
      src={posterImage(
        movie.poster_url ||
        movie.backdrop_url
      )}
      alt={movie.title}
      loading="lazy"
      decoding="async"
      width={342}
      height={513}
      className="w-full h-full object-cover"
    />
  </button>
);

export default HeroSection;
