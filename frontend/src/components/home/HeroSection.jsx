import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { backdropImage } from "../../utils/image";

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
        bg-[#1A0B0C]
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
          alt={main.title}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="
            h-full
            w-full
            object-cover
            animate-ken-burns
          "
        />
      </div>

      <div className="absolute inset-0 bg-gradient-to-r from-[#1A0B0C] via-[#1A0B0C]/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#1A0B0C] via-transparent to-[#1A0B0C]/40" />

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
          <h1
            className="
              text-white
              text-3xl
              sm:text-5xl
              lg:text-6xl
              font-extrabold
              leading-tight
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
                  px-3 py-1 text-[10px] text-blue-200
                  transition-all duration-200
                  hover:-translate-y-0.5 hover:border-blue-400/30
                  hover:bg-blue-500/20 hover:text-white
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
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() =>
                navigate(
                  `/watch/${main.slug}`
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
              //   hover:bg-[#751a6c]
              //   text-white
              //   px-6
              //   py-3
              //   rounded-full
              //   transition
              // "

              className="group relative flex flex-1 sm:flex-none items-center justify-center gap-2 overflow-hidden
                rounded-2xl bg-gradient-to-r from-rose-500 to-[#751a6c]
                px-5 py-3 sm:px-7 sm:py-3.5 text-sm sm:text-base font-bold text-white
                shadow-[0_0_30px_[#1A0B0C]]
                transition-all duration-300
                hover:shadow-[0_0_50px_[]#1A0B0C]
                hover:scale-[1.03] active:scale-95"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r
                from-transparent via-white/25 to-transparent
                transition-transform duration-700 group-hover:translate-x-full" />
              
              تماشای فیلم
            </button>

            <button
              onClick={() =>
                navigate(
                  `/movie/${main.slug}`
                )
              }
              className="
                w-full
                sm:w-auto
                flex
                justify-center
                items-center
                gap-2
                bg-white/10
                hover:bg-white/20
                border
                border-white/10
                text-white
                px-6
                py-3
                rounded-full
                transition
              "
            >
              ⓘ
              اطلاعات بیشتر
            </button>
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
                    ? "w-10 bg-rose-500"
                    : "w-3 bg-white/30"
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
      src={
        movie.poster_url ||
        movie.backdrop_url
      }
      alt={movie.title}
      className="w-full h-full object-cover"
    />
  </button>
);

export default HeroSection;
