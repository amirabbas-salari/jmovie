import { useCallback, useEffect, useRef, useState } from "react";
import api from "../services/api";

const PAGE_SIZE = 12;

// کالکشنی که همیشه بالای صفحه نمایش داده می‌شود
// const FEATURED_COLLECTION_SLUG = "ice-age-collection";
const FEATURED_COLLECTION_SLUG = "the-matrix-collection";

function mapCollection(raw) {
  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    poster: raw.poster,
    poster_url: raw.poster_url,
    backdrop_url: raw.backdrop_url,
    items: raw.items,
    items_preview: raw.items_preview || [],
    items_count: raw.items_count,
  };
}

export default function useCollections() {
  const [collections, setCollections] = useState([]);
  const [featuredCollection, setFeaturedCollection] = useState(null);

  const [search, setSearchState] = useState("");
  const [sort, setSortState] = useState("default");
  const [page, setPageState] = useState(1);

  const [pagination, setPagination] = useState({
    count: 0,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const timer = useRef();

  const setSearch = useCallback((value) => {
    setSearchState(value);
    setPageState(1);
  }, []);

  const setSort = useCallback((value) => {
    setSortState(value);
    setPageState(1);
  }, []);

  /* ==========================
      Featured Collection
  ========================== */

  const fetchFeaturedCollection = useCallback(async () => {
    try {
      const { data } = await api.get(
        `/collections/${FEATURED_COLLECTION_SLUG}/`
      );

      setFeaturedCollection(mapCollection(data));
    } catch (err) {
      console.error("Featured collection error:", err);
      setFeaturedCollection(null);
    }
  }, []);

  /* ==========================
      Collections List
  ========================== */

  const fetchCollections = useCallback(
    async (signal) => {
      setLoading(true);
      setError(null);

      try {
        const { data } = await api.get("/collections/", {
          signal,
          params: {
            page,
            search: search || undefined,
            ordering:
              sort !== "default"
                ? sort
                : "-items_count",
          },
        });

        const rawList = Array.isArray(data)
          ? data
          : data?.results || [];

        const list = rawList.map(mapCollection);

        const count = data.count ?? list.length;

        setCollections(list);

        setPagination({
          count,
          totalPages: Math.max(
            1,
            Math.ceil(count / PAGE_SIZE)
          ),
          hasNext: Boolean(data.next),
          hasPrevious: Boolean(data.previous),
        });
      } catch (err) {
        if (
          err.name === "CanceledError" ||
          err.code === "ERR_CANCELED"
        ) {
          return;
        }

        setError("خطا در دریافت کالکشن‌ها");
      } finally {
        setLoading(false);
      }
    },
    [page, search, sort]
  );

  /* ==========================
      Load Featured Once
  ========================== */

  useEffect(() => {
    // ردیف کالکشنِ صفحه‌ی اصلی featured نمی‌خواهد؛ آن درخواست سنگینِ جدا حذف شود
    if (withFeatured) fetchFeaturedCollection();
  }, [fetchFeaturedCollection, withFeatured]);

  /* ==========================
      Load Collections
  ========================== */

  useEffect(() => {
    const controller = new AbortController();

    clearTimeout(timer.current);

    const delay = search ? 300 : 0;

    timer.current = setTimeout(() => {
      fetchCollections(controller.signal);
    }, delay);

    return () => {
      clearTimeout(timer.current);
      controller.abort();
    };
  }, [fetchCollections, search]);

  return {
    collections,
    featuredCollection,

    loading,
    error,

    search,
    setSearch,

    sort,
    setSort,

    page,
    setPage: setPageState,

    pagination,
  };
}