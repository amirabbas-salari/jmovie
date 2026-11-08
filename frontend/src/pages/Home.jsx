import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import api from "../services/api";
import HeroSection from "../components/home/HeroSection";
import MediaRow from "../components/media/MediaRow";
import CastSection from "../components/media/CastRow";
import CollectionRow from "../components/collections/CollectionRow";


function Home() {
  const navigate = useNavigate();

  const [movies, setMovies] = useState([]);
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [casts, setCasts] = useState([]);

  useEffect(() => {
    api.get("/people/?page_size=10")
    .then((res) => {
      setCasts(res.data.results);
    })
    .catch((err) => {
      console.error(err);
    })
  }, [])

  useEffect(() => {
    let mounted = true;

    Promise.all([
      api.get("/movies/?ordering=-release_date&page_size=10"),
      api.get("/series/?ordering=-release_date&page_size=10"),
    ])
      .then(([moviesRes, seriesRes]) => {
        if (!mounted) return;
        setMovies(moviesRes.data.results ?? moviesRes.data ?? []);
        setSeries(seriesRes.data.results ?? seriesRes.data ?? []);
      })
      .catch((err) => console.error(err))
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, []);

  // ترکیب فیلم‌ها و سریال‌ها برای هیرو، مرتب بر اساس تاریخ اضافه شدن
  const heroItems = useMemo(() => {
    const withType = [
      ...movies.map((m) => ({ ...m, type: "movie" })),
      ...series.map((s) => ({ ...s, type: "series" })),
    ];

    const addedTime = (item) =>
      item.release_date
        ? new Date(item.release_date).getTime() // created_add changed to release_date
        : (item.id ?? 0);

    return withType
      .sort((a, b) => addedTime(b) - addedTime(a)) // جدیدترین اول
      .slice(0, 8);
  }, [movies, series]);

  if (loading) {
    return (
      <div className="min-h-screen px-4 pb-16 pt-24 sm:px-10 lg:px-16" dir="rtl" aria-label="در حال بارگذاری">
        <div className="skeleton relative min-h-[62vh] overflow-hidden rounded-[28px]">
          <div className="absolute bottom-8 right-6 left-6 space-y-4 sm:right-10">
            <div className="h-5 w-32 rounded-full bg-white/15" />
            <div className="h-12 max-w-xl rounded-2xl bg-white/15" />
            <div className="h-4 max-w-md rounded-full bg-white/10" />
            <div className="flex gap-3 pt-2">
              <div className="h-11 w-36 rounded-full bg-rose-400/25" />
              <div className="h-11 w-32 rounded-full bg-white/10" />
            </div>
          </div>
        </div>
        <div className="mt-10 grid grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-4 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="skeleton aspect-[2/3]" />
              <div className="mx-auto h-3 w-4/5 rounded-full bg-white/[0.08]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" dir="rtl">
      <HeroSection movies={heroItems} />

      <MediaRow
        title="فیلم‌ها"
        media={movies}
        type="movie"
        onSeeAll={() => navigate("/movies/")}
      />
      <MediaRow
        title="سریال‌ها"
        media={series}
        type="series"
        onSeeAll={() => navigate("/series/")}
      />
      {/* <MediaRow
        title="ترین های IMDB"
        media={suggestion}
        type="movie"
        onSeeAll={() => navigate("/movies/?orderby=imdb_rating")}
      /> */}

      <CollectionRow
        onSeeAll={() => navigate("/collections/")}
      />

      <CastSection cast={casts} title={"بازیگران"} onSeeAll={() => navigate("/casts/")} />

    </div>
  );
}

export default Home;
