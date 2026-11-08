import { Star, ImageOff } from "lucide-react";

const EpisodeCard = ({ episode, selected, onClick }) => {
  const image =
    episode.still_image_url ||
    episode.still_image ||
    null;

  return (
    <button
      onClick={onClick}
      className={`
        group
        relative
        overflow-hidden
        rounded-2xl
        border
        text-right
        transition-all
        duration-300
        ${
          selected
            ? "border-rose-500 shadow-lg shadow-rose-700/30 scale-[1.02]"
            : "border-white/10 hover:border-rose-500/40 hover:scale-[1.02]"
        }
      `}
    >
      {/* Background */}

      {image ? (
        <img
          src={image}
          alt={episode.title}
          loading="lazy"
          decoding="async"
          className="
            absolute
            inset-0
            h-full
            w-full
            object-cover
            transition-transform
            duration-500
            group-hover:scale-110
          "
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <ImageOff
            size={40}
            className="text-zinc-600"
          />
        </div>
      )}

      {/* Overlay */}

      <div
        className="
          absolute
          inset-0
          bg-gradient-to-t
          from-black
          via-black/40
          to-transparent
        "
      />

      {/* Selected Overlay */}

      {selected && (
        <div className="absolute inset-0 bg-rose-700/20" />
      )}

      {/* Content */}

      <div
        className="
          relative
          flex
          h-44
          flex-col
          justify-end
          p-4
        "
      >
        {/* Number */}

        <div
          className="
            absolute
            left-3
            top-2
            text-7xl
            font-black
            leading-none
            text-white/50
            select-none
          "
        >
          {String(episode.episode_number).padStart(2, "0")}
        </div>


        {/* Rating */}

        <div className="mt-2 flex items-center justify-between">
          
          {/* Title */}

          <h3
            className="
              line-clamp-2
              text-sm
              font-bold
              text-white
            "
          >
            {episode.title}
          </h3>

          <div className="flex items-center gap-1 text-yellow-400">

            <Star
              size={14}
              fill="currentColor"
            />

            <span className="text-xs font-medium">
              {episode.vote_average ?? "-"}
            </span>

          </div>

          {/* <span className="text-xs text-zinc-300">
            قسمت {episode.episode_number}
          </span> */}

        </div>

      </div>

      {/* Selected Bar */}

      <div
        className={`
          absolute
          bottom-0
          left-0
          h-1
          bg-gradient-to-r
          from-rose-800
          to-rose-500
          transition-all
          duration-300
          ${
            selected
              ? "w-full"
              : "w-0"
          }
        `}
      />
    </button>
  );
};

export default EpisodeCard;