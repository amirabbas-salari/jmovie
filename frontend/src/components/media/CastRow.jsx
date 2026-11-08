import { useRef } from "react";
import { useNavigate } from 'react-router-dom';
import { FiChevronRight, FiChevronLeft } from "react-icons/fi";
import SectionHeader from "../ui/SectionHeader";
import { profileImage } from "../../utils/image";

const Avatar = ({ person }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    // بررسی کنید که slug وجود داره
    if (person.slug) {
      navigate(`/person/${person.slug}`);
    } else {
      // اگر slug نداشت، از id یا name استفاده کنید
      const slug = person.name?.toLowerCase().replace(/\s+/g, '-') + "-" + person.tmdb_id || `person-${person.id}`; //TODO
      navigate(`/person/${slug}`);
    }
  };


  return (
    <div onClick={handleClick} className="group flex w-24 shrink-0 cursor-pointer flex-col items-center gap-2.5 text-center">
      <div className="rounded-full bg-gradient-to-br from-rose-500 via-fuchsia-500 to-violet-600 p-[2px] shadow-glow-sm transition-transform duration-300 group-hover:-translate-y-1">
        <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-[#120818] bg-white/5">
          {person.profile_image || person.profile_image_url ? (
            <img
              src={profileImage(person.profile_image || person.profile_image_url)}
              alt={person.name}
              loading="lazy"
              decoding="async"
              width={96}
              height={96}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-brand-soft text-2xl font-black text-rose-200">
              {person.name?.[0] ?? "?"}
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="text-sm font-bold text-white transition-colors group-hover:text-rose-200">{person.name}</p>
        {person.character && (
          <p className="mt-0.5 text-xs text-zinc-500">{person.character}</p>
        )}
      </div>
    </div>
  );
}

const CastSection = ({
  cast = [],
  director,
  onSeeAll,
  title = "بازیگران",
}) => {
  const scrollRef = useRef(null);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;

    const amount = el.clientWidth * 0.8;

    el.scrollBy({
      left: dir === "next" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <section dir="rtl" className="cv-auto">

      <SectionHeader
        title={title}
        eyebrow="چهره‌های محبوب"
        onSeeAll={onSeeAll}
        className="px-6 sm:px-10 lg:px-16"
      />


      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* بازیگران */}
        <div className="min-w-0 flex-1">
          {cast.length ? (
            <div className="group/row relative">
              {/* دکمه قبلی */}
              <button
                type="button"
                onClick={() => scroll("prev")}
                aria-label="قبلی"
                className="absolute right-0 top-1/2 z-20 hidden h-full w-16 -translate-y-1/2 items-center justify-center bg-gradient-to-l from-black/80 to-transparent opacity-0 transition-opacity duration-300 group-hover/row:opacity-100 md:flex"
              >
                <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10 backdrop-blur-md transition-all hover:scale-110 hover:bg-white/20">
                  <FiChevronRight className="text-2xl text-white" />
                </span>
              </button>

              {/* دکمه بعدی */}
              <button
                type="button"
                onClick={() => scroll("next")}
                aria-label="بعدی"
                className="absolute left-0 top-1/2 z-20 hidden h-full w-16 -translate-y-1/2 items-center justify-center bg-gradient-to-r from-black/80 to-transparent opacity-0 transition-opacity duration-300 group-hover/row:opacity-100 md:flex"
              >
                <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10 backdrop-blur-md transition-all hover:scale-110 hover:bg-white/20">
                  <FiChevronLeft className="text-2xl text-white" />
                </span>
              </button>

              {/* لیست بازیگران */}
              <div
                ref={scrollRef}
                className="flex gap-5 overflow-x-auto scroll-smooth pb-3 pr-16 pl-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              >
                {cast.map((person) => (
                  <div
                    key={person.slug ?? person.name}
                    className="flex-shrink-0"
                  >
                    <Avatar person={person} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              اطلاعات بازیگران ثبت نشده.
            </p>
          )}
        </div>

        {/* کارگردان */}
        {director && (
          <div className="flex flex-shrink-0 flex-col items-center justify-center gap-2 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md md:w-48">
            <span className="text-xs font-medium text-rose-300">
              کارگردان
            </span>

            <Avatar person={director} />
          </div>
        )}
      </div>
    </section>
  );
};

export default CastSection;