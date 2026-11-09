import api from "../../services/api";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import DetailsHero from "../../components/details/DetailsHero";
import AboutSection from "../../components/details/AboutSection";
import CastSection from "../../components/media/CastRow";
// import SeasonsSection from "../../components/series-details/--SeasonsSection";
import Gallery from "../../components/details/Gallery";
import MediaRow from "../../components/media/MediaRow";
import CommentsSection from "../../components/media/CommentsSection";
import SeasonsSection from "../../components/series-details/index";
import { normalize } from "../../utils/movie";
import { useSeo } from "../../seo/useSeo";
import { breadcrumbJsonLd, seriesJsonLd } from "../../seo/jsonLd";

const SeriesDetails = () => {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [series, setSeries] = useState(null);

  // سئو: تایتل/دیسکریپشن هدفمند برای «دانلود سریال X» + داده‌ی ساخت‌یافته
  useSeo({
    title: series
      ? `دانلود سریال ${series.title} (${series.original_title || ""} ${series.year || ""}) با زیرنویس فارسی | مووی‌ورس`
      : "دانلود سریال | مووی‌ورس",
    description: series
      ? `دانلود و تماشای آنلاین سریال ${series.title} (${series.original_title || ""}) با امتیاز ${series.imdb_rating || "—"} در IMDb، زیرنویس فارسی و کیفیت‌های متنوع در مووی‌ورس. ${series.description ? String(series.description).slice(0, 110) : ""}`
      : undefined,
    keywords: series
      ? `دانلود سریال ${series.original_title}, دانلود سریال ${series.title}, ${series.original_title} با زیرنویس فارسی, تماشای آنلاین ${series.original_title}`
      : undefined,
    path: series ? `/series/${series.slug}` : undefined,
    image: series?.backdrop_url || series?.poster_url,
    type: "video.tv_show",
    jsonLd: series
      ? [
          seriesJsonLd(series),
          breadcrumbJsonLd([
            { name: "خانه", path: "/" },
            { name: "سریال‌ها", path: "/series" },
            { name: series.title, path: `/series/${series.slug}` },
          ]),
        ]
      : undefined,
  });
  const [suggestions, setSuggestions] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);


  // ارسال کامنت جدید
  const handleAddComment = async (text) => {
    if (!text?.trim() || !series?.id) return;
    try {
      const res = await api.post(`/comments/`, {
        series: series.id,
        text: text.trim(),
      });
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
      .get(`/series/${slug}/`)
      .then(async (res) => {
        if (!alive) return;
        const data = normalize(res.data);
        setSeries(data);

        // --- کامنت‌ها ---
        try {
          const cm = await api.get(`/comments/`, {
            params: { series: data.id, page_size: 50 },
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
          const sug = await api.get(`/series/`, {
            params: { genre: g, page_size: 8 },
          });
          const list = (sug.data.results ?? sug.data ?? []).filter(
            (s) => s.slug !== slug
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

  if (!series) return null;

  return (
    <main className="bg-[#08040d]">
      <DetailsHero media={series} mediaType="series" />
      <Gallery images={series.gallery} title={series.title} />

      <AboutSection title={series.title} description={series.description} />

      <div className="mx-auto flex max-w-7xl flex-col gap-14 px-[3%] py-14">
        <SeasonsSection seasons={series.seasons} />
      </div>

      <div className="mx-auto max-w-7xl">
        <CastSection cast={series.cast} title={"عوامل"} />
      </div>

      <div className="px-0">
        <MediaRow
          title="پیشنهادی"
          media={suggestions}
          type="series"
          onSeeAll={() => navigate("/series")}
        />

        <CommentsSection
          comments={comments}
          mediaId={series.id}
          onAddComment={handleAddComment}
        />
      </div>
    </main>
  );
};

export default SeriesDetails;
