import api from "../../services/api";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import DetailsHero from "../../components/details/DetailsHero";
import AboutSection from "../../components/details/AboutSection";
import CastSection from "../../components/media/CastRow";
// import DownloadSection from "../../components/details/DownloadSection";
import DownloadSection from "../../components/downloads/DownloadSection";
import Gallery from "../../components/details/Gallery";
import MediaRow from "../../components/media/MediaRow";
import CommentsSection from "../../components/media/CommentsSection";
import { normalize } from "../../utils/movie";
import { useSeo } from "../../seo/useSeo";
import { breadcrumbJsonLd, movieJsonLd } from "../../seo/jsonLd";

const MovieDetails = () => {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [movie, setMovie] = useState(null);

  // سئو: تایتل/دیسکریپشن هدفمند برای «دانلود فیلم X» + داده‌ی ساخت‌یافته
  useSeo({
    title: movie
      ? `دانلود فیلم ${movie.title} (${movie.original_title || ""} ${movie.year || ""}) با زیرنویس فارسی | مووی‌ورس`
      : "دانلود فیلم | مووی‌ورس",
    description: movie
      ? `دانلود و تماشای آنلاین فیلم ${movie.title} (${movie.original_title || ""}) محصول ${movie.year || ""} با امتیاز ${movie.imdb_rating || "—"} در IMDb، زیرنویس فارسی و کیفیت‌های 480p تا 4K در مووی‌ورس. ${movie.description ? String(movie.description).slice(0, 110) : ""}`
      : undefined,
    keywords: movie
      ? `دانلود فیلم ${movie.original_title}, دانلود فیلم ${movie.title}, ${movie.original_title} با زیرنویس فارسی, تماشای آنلاین ${movie.original_title}`
      : undefined,
    path: movie ? `/movie/${movie.slug}` : undefined,
    image: movie?.backdrop_url || movie?.poster_url,
    type: "video.movie",
    jsonLd: movie
      ? [
          movieJsonLd(movie),
          breadcrumbJsonLd([
            { name: "خانه", path: "/" },
            { name: "فیلم‌ها", path: "/movies" },
            { name: movie.title, path: `/movie/${movie.slug}` },
          ]),
        ]
      : undefined,
  });
  const [suggestions, setSuggestions] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);


  // ارسال کامنت جدید
  const handleAddComment = async (text) => {
    if (!text?.trim() || !movie?.id) return;
    try {
      const res = await api.post(`/comments/`, {
        movie: movie.id,
        text: text.trim(),
      });
      // کامنت جدید رو بالای لیست اضافه می‌کنیم
      setComments((prev) => [res.data, ...prev]);
    } catch (e) {
      console.error("Add comment failed", e);
    }
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setSuggestions([]);
    setComments([]);

    api
      .get(`/movies/${slug}/`)
      .then(async (res) => {
        if (!alive) return;
        const data = normalize(res.data);
        setMovie(data);

        // --- کامنت‌ها ---
        try {
          const cm = await api.get(`/comments/`, {
            params: { movie: data.id, page_size: 50 },
          });
          const list = cm.data.results ?? cm.data ?? [];
          if (alive) setComments(list);
        } catch (e) {
          console.error("Comments failed", e);
        }

        // --- پیشنهادها ---
        const g = data.genres?.[0]?.slug;
        if (!g) return;
        try {
          const sug = await api.get(`/movies/`, {
            params: { genre: g, page_size: 8 },
          });
          const list = (sug.data.results ?? sug.data ?? []).filter(
            (m) => m.slug !== slug
          );
          if (alive) setSuggestions(list);
        } catch (e) {
          console.error("Suggestions failed", e);
        }
      })
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [slug]);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08040d]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-rose-500" />
      </div>
    );

  if (!movie) return null;

  return (
    <main className="bg-[#08040d]">
      <DetailsHero media={movie} mediaType="movie" />
      <Gallery images={movie.gallery} title={movie.title} />

      <AboutSection title={movie.title} description={movie.description} />

      <div className="mx-auto flex max-w-7xl flex-col gap-14 px-[3%] py-14">
        <DownloadSection downloads={movie.downloads} />
      </div>

      <div className="mx-auto max-w-7xl">
        <CastSection cast={movie.cast} title={"عوامل"} />
      </div>

      <div className="px-0">
      <MediaRow
          title="پیشنهادی"
          media={suggestions}
          type="movie"
          onSeeAll={() => navigate("/movies")}
      />

      <CommentsSection
        comments={comments}
        mediaId={movie.id}
        onAddComment={handleAddComment}
      />
      </div>

    </main>
  );
};

export default MovieDetails;
