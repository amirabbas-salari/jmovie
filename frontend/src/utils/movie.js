const fmtRuntime = (min) => {
  if (!min || min > 1000) return null;
  const h = Math.floor(min / 60),
    m = min % 60;
  return h > 0 ? `${h} ساعت و ${m} دقیقه` : `${m} دقیقه`;
};

export const normalize = (d = {}) => {
  const cast = d.cast ?? [];

  return {
    id: d.id,
    slug: d.slug,
    title: d.title,
    original_title: d.original_title,
    year: d.release_date ? new Date(d.release_date).getFullYear() : d.year,
    imdb_rating: parseFloat(d.imdb_rating) || 0,
    imdb_votes: d.imdb_votes?.toLocaleString("fa-IR"),
    // مقادیر خام برای سئو/JSON-LD (مدت به دقیقه و تعداد رأی عددی)
    imdb_votes_count: d.imdb_votes,
    runtime_minutes: d.runtime,
    poster_url: d.poster_url,
    views: d.views?.toLocaleString("fa-IR"),
    duration: fmtRuntime(d.runtime),
    // country: d.country,
    description: d.description,
    poster: d.poster,
    backdrop: d.backdrop,
    backdrop_url: d.backdrop_url,
    seasons: d.seasons|| [],

    genres: (d.genres || []).map((g) =>
      typeof g === "object"
        ? { name: g.name, slug: g.slug }
        : { name: g, slug: g }
    ),

    cast: cast
      .filter((c) => c.role === "actor" && c.person)
      .map((c) => ({
        id: c.person.id,
        tmdb_id: c.person.tmdb_id,
        slug: c.person.slug,
        name: c.person.name,
        profile_image: c.person.profile_image,
        profile_image_url: c.person.profile_image_url,
        character: c.character_name,
      })),

    director: cast.find((c) => c.role === "director" && c.person)?.person,

    downloads: (d.download_links ?? d.downloads ?? []).map((l) => ({
      id: l.id,
      quality: l.quality, // مثلا "1080p"
      size: l.size, // مثلا "1.8 GB"
      encoder: l.encoder || "x265",
      url: l.url,
      subtitle: l.subtitle, // boolean
      is_active: l.is_active,
      is_vip: l.is_vip,
      content_type: l.content_type,
      title: l.title,
      language: l.language,
    })),

    gallery: (d.gallery_images ?? d.gallery ?? d.images ?? []).map((g) =>
      typeof g === "object"
        ? { url: g.image ?? g.image_url ?? g.src, caption: g.caption ?? g.title ?? "" }
        : { url: g, caption: "" }
    ),

    comments: (d.comments ?? []).map((c) => ({
      id: c.id,
      text: c.text ?? c.body ?? c.content ?? "",
      likes: c.likes ?? c.likes_count ?? 0,
      dislikes: c.dislikes ?? c.dislikes_count ?? 0,
      created_at: c.created_at,
      user: {
        id: c.user?.id ?? c.author?.id,
        name: c.user?.name ?? c.author?.name ?? "کاربر",
        avatar: c.user?.avatar ?? c.user?.profile_image ?? c.author?.avatar,
      },
    })),

    suggestions: [],
  };
};
