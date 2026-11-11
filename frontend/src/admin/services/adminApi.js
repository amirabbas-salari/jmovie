import api from "../../services/api"

// ---------------------------------------------------------------------------
// کمکی‌ها
// ---------------------------------------------------------------------------
// وقتی آدرس API اشتباه باشد سرور فرانت (نت‌لیفای) به‌جای JSON فایل
// index.html را برمی‌گرداند؛ آن را به‌عنوان «لیست خالی» نشان نده.
export const ensureJson = (data) => {
  if (typeof data === "string") {
    throw new Error("پاسخ سرور معتبر نیست — احتمالاً VITE_API_BASE_URL در بیلد فرانت تنظیم نشده است.")
  }
  return data
}

export const normalizeList = (data) => {
  ensureJson(data)
  if (Array.isArray(data)) return { items: data, total: data.length, pages: 1 }
  if (data && Array.isArray(data.results)) {
    return {
      items: data.results,
      total: data.count ?? data.results.length,
      pages: data.count ? Math.max(1, Math.ceil(data.count / (data.results.length || 24))) : 1,
    }
  }
  return { items: [], total: 0, pages: 1 }
}

export const getApiError = (err, fallback = "خطایی رخ داد. دوباره تلاش کنید.") => {
  const data = err?.response?.data
  if (!data) return fallback
  if (typeof data === "string") return data
  if (data.detail) return data.detail
  const first = Object.values(data).flat?.()[0]
  return first ? String(first) : fallback
}

export const getFieldErrors = (err) => {
  const data = err?.response?.data
  if (data && typeof data === "object" && !data.detail) return data
  return {}
}

// CRUD ساز عمومی برای همه‌ی منابع پنل
const crud = (path) => ({
  list: async (params = {}) => normalizeList((await api.get(path, { params })).data),
  get: async (id) => (await api.get(`${path}${id}/`)).data,
  create: async (payload) => (await api.post(path, payload)).data,
  update: async (id, payload) => (await api.patch(`${path}${id}/`, payload)).data,
  remove: async (id) => (await api.delete(`${path}${id}/`)).data,
})

// ---------------------------------------------------------------------------
// هویت و داشبورد (تک‌درخواست به‌جای ۴ لیست کامل)
// ---------------------------------------------------------------------------
export const getAdminMe = async () => (await api.get("/admin/me/")).data
export const getAdminDashboard = async () => ensureJson((await api.get("/admin/dashboard/")).data)
export const getPermissionCatalog = async () => (await api.get("/admin/permissions/")).data
export const tmdbLookup = async (params) => (await api.get("/admin/tmdb/lookup/", { params })).data

// ---------------------------------------------------------------------------
// منابع محتوا
// ---------------------------------------------------------------------------
// حذف گروهی + پاکسازی آثار بدون لینک دانلود (مشترک فیلم/سریال)
// برای این سه اکشن timeout صریح می‌گذاریم: روی داده‌ی حجیم ممکن است پاسخ
// چند ثانیه طول بکشد و بدون timeout، هنگِ سرور/شبکه در فرانت به‌صورت
// «دکمه هیچ کاری نمی‌کند» دیده می‌شود؛ با timeout خطا واضح نمایش داده می‌شود.
const mediaCrud = (path) => ({
  ...crud(path),
  bulkDelete: async (ids) => (await api.post(`${path}bulk-delete/`, { ids }, { timeout: 120000 })).data,
  withoutDownloadsCount: async () => (await api.get(`${path}without-downloads-count/`, { timeout: 120000 })).data,
  withoutDownloads: async () => (await api.get(`${path}without-downloads/`, { timeout: 120000 })).data,
  purgeWithoutDownloads: async () => (await api.post(`${path}purge-without-downloads/`, {}, { timeout: 300000 })).data,
})

export const moviesApi = mediaCrud("/admin/movies/")
export const seriesApi = mediaCrud("/admin/series/")
export const seasonsApi = crud("/admin/seasons/")
export const episodesApi = crud("/admin/episodes/")
export const peopleApi = crud("/admin/people/")
export const genresApi = crud("/admin/genres/")
export const collectionsApi = crud("/admin/collections/")
export const collectionItemsApi = crud("/admin/collection-items/")
export const downloadsApi = crud("/admin/downloads/")
export const commentsApi = {
  ...crud("/admin/comments/"),
  approve: async (id) => (await api.post(`/admin/comments/${id}/approve/`)).data,
  reject: async (id) => (await api.post(`/admin/comments/${id}/reject/`)).data,
}
export const usersApi = {
  ...crud("/admin/users/"),
  toggleActive: async (id) => (await api.post(`/admin/users/${id}/toggle_active/`)).data,
  assignRoles: async (id, roleIds) =>
    (await api.post(`/admin/users/${id}/assign_roles/`, { role_ids: roleIds })).data,
}
export const rolesApi = crud("/admin/roles/")
export const auditLogsApi = crud("/admin/audit-logs/")

// ایجنت محتوا (آوردن خودکار فیلم/سریال از TMDB)
export const agentApi = {
  getSettings: async () => (await api.get("/agent/settings/")).data,
  updateSettings: async (payload) => (await api.patch("/agent/settings/", payload)).data,
  run: async (payload = {}) => (await api.post("/agent/run/", payload)).data,
  runs: async () => (await api.get("/agent/runs/")).data,
  drafts: async (params = {}) => (await api.get("/agent/drafts/", { params })).data,
  act: async (id, action) => (await api.post(`/agent/drafts/${id}/${action}/`)).data,
  bulk: async (ids, action) => (await api.post("/agent/drafts/bulk/", { ids, action })).data,
}

// سازگاری با نام‌های قدیمی (اگر جایی هنوز استفاده شوند)
export const getAdminMovies = (params) => moviesApi.list(params)
export const getAdminSeries = (params) => seriesApi.list(params)
export const getAdminGenres = (params) => genresApi.list(params)
export const getAdminUsers = (params) => usersApi.list(params)
