import { useEffect, useMemo, useState } from "react";

import SeasonTabs from "./SeasonTabs";
import EpisodeGrid from "./EpisodeGrid";

const SeasonsSection = ({ seasons = [] }) => {
  const [activeSeason, setActiveSeason] = useState(0);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(null);

  const currentSeason = useMemo(() => {
    return seasons[activeSeason] || null;
  }, [seasons, activeSeason]);

  const episodes = currentSeason?.episodes || [];

  // با تغییر فصل، اولین قسمت همان فصل انتخاب شود
  useEffect(() => {
    if (episodes.length) {
      // setSelectedEpisodeId(episodes[0].id);
      setSelectedEpisodeId(null);
    } else {
      setSelectedEpisodeId(null);
    }
  }, [activeSeason]);

  if (!seasons.length) {
    return (
      <section
        dir="rtl"
        className="rounded-3xl border border-rose-700/20 bg-[#08040d] p-8"
      >
        <h2 className="mb-6 text-2xl font-bold text-white">
          قسمت‌ها
        </h2>

        <div className="rounded-2xl bg-[#08040d] py-12 text-center text-zinc-400">
          هنوز قسمتی برای این سریال ثبت نشده است.
        </div>
      </section>
    );
  }

  const handleSelectEpisode = (episodeId) => {
    setSelectedEpisodeId((prev) =>
      prev === episodeId ? null : episodeId
    );
  };

  return (
    <section
      dir="rtl"
      className="
        rounded-3xl
        border
        border-rose-700/20
        bg-gradient-to-b
        from-[#161010]
        via-[#121212]
        to-[#0d0d0d]
        p-6
      "
    >
      {/* Header */}

      <div className="mb-8 flex items-center gap-4">

        <h2 className="text-3xl font-extrabold text-white">
          قسمت‌ها
        </h2>

        <div className="h-px flex-1 bg-gradient-to-l from-rose-800/40 to-transparent" />

      </div>

      {/* Tabs */}

      <SeasonTabs
        seasons={seasons}
        activeSeason={activeSeason}
        onChange={setActiveSeason}
      />

      {/* Episodes */}

      <EpisodeGrid
        episodes={episodes}
        selectedEpisodeId={selectedEpisodeId}
        onSelectEpisode={handleSelectEpisode}
      />
    </section>
  );
};

export default SeasonsSection;