import { useCallback, useEffect, useRef, useState } from "react";
import api from "../services/api";

const PAGE_SIZE = 20;

function extractList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

// پاسخ جستجو می‌تواند یا آرایه‌ی مستقیم باشد (MovieSearchView/SeriesSearchView)
// یا یک object با کلید movies/series (GlobalSearchView). این تابع هر دو حالت را پوشش می‌دهد.
function extractSearchList(data, key) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  return [];
}

export default function useMediaList(endpoint, mapper) {
  const [filters, setFilters] = useState({
    query: "",
    year: "",
    country: "",
    actor: "",
    director: "",
    genres: [],
  });

  const [media, setMedia] = useState([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({
    count: 0,
    next: null,
    previous: null,
    totalPages: 1,
  });

  const timer = useRef(null);

  // کلید مربوط به نوع مدیا در پاسخ GlobalSearchView (movies یا series)
  const searchKey = endpoint.replace(/\//g, "");

  const fetchMedia = useCallback(async (f, currentPage, signal) => {
    setLoading(true);
    setError(null);

    try {
      const isSearch = !!f.query;

      const url = isSearch
        ? `/search/${endpoint.replace("/", "")}`
        : endpoint;

      const { data } = await api.get(url, {
        signal,
        params: {
          q: f.query || undefined,
          page: currentPage,
          year: f.year || undefined,
          country: f.country || undefined,
          actor: f.actor || undefined,
          director: f.director || undefined,
          genre__in: f.genres.length
            ? f.genres.join(",")
            : undefined,
        },
      });

      let items;
      let count;
      let next = null;
      let previous = null;

      if (isSearch) {
        // MovieSearchView/SeriesSearchView یک آرایه‌ی خام برمی‌گردانند و
        // GlobalSearchView یک object با کلید movies/series برمی‌گرداند.
        // هر دو حالت را پشتیبانی می‌کنیم و نتایج را از mapper عبور می‌دهیم
        // تا فیلدها (poster, year, ...) دقیقاً مثل حالت غیرِ جستجو نرمال شوند.
        const raw = extractSearchList(data, searchKey);
        items = raw.map(mapper);

        // این ویوهای جستجو صفحه‌بندی سمت سرور ندارند (کل نتایج یک‌جا می‌آیند)
        count = items.length;
      } else {
        items = extractList(data).map(mapper);
        count = data?.count ?? items.length;
        next = data?.next ?? null;
        previous = data?.previous ?? null;
      }

      setMedia(items);

      setPagination({
        count,
        next,
        previous,
        totalPages: Math.max(1, Math.ceil(count / PAGE_SIZE)),
      });
    } catch (err) {
      setError(err?.response?.data?.detail ?? "خطا در دریافت اطلاعات");
    } finally {
      setLoading(false);
    }
  }, [endpoint, mapper, searchKey]);

  /*
   * هنگام تغییر فیلترها
   * صفحه به ۱ برگردد.
   */
  useEffect(() => {
    setPage(1);
  }, [
    filters.query,
    filters.year,
    filters.country,
    filters.actor,
    filters.director,
    JSON.stringify(filters.genres),
  ]);

  /*
   * دریافت اطلاعات
   */
  useEffect(() => {
    const controller = new AbortController();

    clearTimeout(timer.current);

    timer.current = setTimeout(() => {
      fetchMedia(filters, page, controller.signal);
    }, 400);

    return () => {
      clearTimeout(timer.current);
      controller.abort();
    };
  }, [filters, page, fetchMedia]);

  return {
    media,

    filters,

    setFilters,

    loading,

    error,

    page,

    setPage,

    pagination,

  };
}