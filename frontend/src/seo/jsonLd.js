// سازنده‌های داده‌ی ساخت‌یافته (schema.org) — همان چیزی که باعث
// نمایش ستاره‌ی امتیاز، پوستر و اطلاعات فیلم در نتایج گوگل (Rich
// Results) می‌شود.
import { SITE_NAME, absoluteUrl } from "./site";

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: "MovieVerse",
    url: absoluteUrl("/"),
    inLanguage: "fa-IR",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/movies")}?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    alternateName: "MovieVerse",
    url: absoluteUrl("/"),
    logo: absoluteUrl("/Logo-red.svg"),
  };
}

function ratingOf(media) {
  const rating = parseFloat(media.imdb_rating);
  if (!rating) return undefined;
  const out = {
    "@type": "AggregateRating",
    ratingValue: rating,
    bestRating: 10,
    worstRating: 1,
  };
  const votes = Number(media.imdb_votes_count || media.votes_count);
  if (votes > 0) out.ratingCount = votes;
  return out;
}

function peopleOf(media) {
  const actor = (media.cast || [])
    .slice(0, 10)
    .map((c) => ({ "@type": "Person", name: c.name || c.person?.name }))
    .filter((p) => p.name);
  const directorName = media.director?.name;
  return {
    ...(actor.length ? { actor } : {}),
    ...(directorName
      ? { director: { "@type": "Person", name: directorName } }
      : {}),
  };
}

function baseMedia(media, path) {
  return {
    name: media.original_title || media.title,
    alternateName: media.title,
    description: media.description || undefined,
    image: [media.backdrop_url, media.poster_url || media.poster]
      .filter(Boolean)
      .map((u) => absoluteUrl(u)),
    url: absoluteUrl(path),
    datePublished: media.year ? String(media.year) : undefined,
    genre: (media.genres || [])
      .map((g) => (typeof g === "object" ? g.name : g))
      .filter(Boolean),
    inLanguage: "fa-IR",
    aggregateRating: ratingOf(media),
    ...peopleOf(media),
  };
}

function isoDuration(minutes) {
  const min = Number(minutes);
  if (!min || min <= 0) return undefined;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}` || undefined;
}

export function movieJsonLd(media) {
  return {
    "@context": "https://schema.org",
    "@type": "Movie",
    ...baseMedia(media, `/movie/${media.slug}`),
    duration: isoDuration(media.runtime_minutes || media.runtime),
  };
}

export function seriesJsonLd(media) {
  const seasons = media.seasons?.length;
  return {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    ...baseMedia(media, `/series/${media.slug}`),
    ...(seasons ? { numberOfSeasons: seasons } : {}),
  };
}

export function breadcrumbJsonLd(items) {
  // items: [{name, path}]
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function itemListJsonLd({ name, description, items }) {
  // items: [{name, path, image}]
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    description,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: absoluteUrl(item.path),
      ...(item.image ? { image: absoluteUrl(item.image) } : {}),
    })),
  };
}

export function personJsonLd(person) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: person.original_name || person.name,
    alternateName: person.name,
    description: person.biography || person.bio || undefined,
    image: person.profile_image || person.profile_image_url || undefined,
    birthDate: person.birth_date || undefined,
    url: absoluteUrl(`/person/${person.slug}`),
  };
}

export function collectionJsonLd(collection, items) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: collection.title || collection.name,
    description: collection.description || undefined,
    url: absoluteUrl(`/collection/${collection.slug}`),
    mainEntity: itemListJsonLd({
      name: collection.title || collection.name,
      items,
    }),
  };
}
