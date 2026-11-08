export default function mapMedia(raw) {
  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title ?? raw.name,
    original_title: raw.original_title,
    description: raw.description,
    duration: raw.runtime,
    year: raw.year ?? raw.release_date?.slice(0, 4),
    rating: raw.rating ?? raw.vote_average,
    poster: raw.poster ?? raw.poster_url ?? raw.image,
    genres: raw.genres,
  };
}