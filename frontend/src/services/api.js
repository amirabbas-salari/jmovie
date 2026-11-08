import axios from 'axios'
import {
  getAccessToken,
  getRefreshToken,
  saveTokens,
  clearTokens,
} from '../utils/token'

if (import.meta.env.PROD && !import.meta.env.VITE_API_BASE_URL) {
  // بدون این متغیر، درخواست‌ها به دامنه‌ی فرانت می‌روند و index.html
  // برمی‌گردد و همه‌ی بخش‌های وابسته به API (از جمله پنل) خراب می‌شوند.
  console.error("[api] VITE_API_BASE_URL تنظیم نشده است؛ آدرس بک‌اند را در محیط بیلد (مثلاً Netlify) ست کنید.")
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "",
})

// ── کش سبکِ پاسخ‌های GET عمومی ─────────────────────────────────────
// ناوبری تکراری بین صفحات (خانه ←→ فیلم‌ها و…) و سرچ‌های تکراری هر بار
// به شبکه نمی‌روند: پاسخ موفق GETهای بدون لاگین تا ۶۰ ثانیه در حافظه
// نگه داشته و درخواست هم‌زمانِ تکراری هم فقط یک بار فرستاده می‌شود.
// درخواست‌های لاگین‌دار و درخواست‌های دارای AbortController از کش
// عبور می‌کنند و هر mutation کل کش را خالی می‌کند.
const GET_CACHE_TTL = 60_000
const GET_CACHE_MAX = 80
const getCache = new Map()

const _get = api.get.bind(api)
api.get = (url, config = {}) => {
  if (config.skipCache || config.signal || getAccessToken()) {
    return _get(url, config)
  }
  const key = `${url}?${JSON.stringify(config.params ?? {})}`
  const hit = getCache.get(key)
  if (hit && Date.now() - hit.time < GET_CACHE_TTL) return hit.promise

  const promise = _get(url, config).catch((err) => {
    getCache.delete(key)
    throw err
  })
  getCache.set(key, { time: Date.now(), promise })
  if (getCache.size > GET_CACHE_MAX) {
    getCache.delete(getCache.keys().next().value)
  }
  return promise
}

api.interceptors.request.use(config => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error)
    else prom.resolve(token)
  })
  failedQueue = []
}

api.interceptors.response.use(
  res => {
    // هر تغییری روی سرور (ثبت کامنت، ویرایش پروفایل و…) کش خواندن را باطل می‌کند
    if (res.config?.method && res.config.method !== 'get') getCache.clear()
    return res
  },
  err => {
    const originalRequest = err.config

    if (err.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      return new Promise((resolve, reject) => {
        axios
          .post(
            `${import.meta.env.VITE_API_BASE_URL || ""}/api/token/refresh/`,
            { refresh: getRefreshToken() }
          )
          .then(({ data }) => {
            saveTokens(data.access, getRefreshToken())
            api.defaults.headers.Authorization = `Bearer ${data.access}`
            processQueue(null, data.access)
            resolve(api(originalRequest))
          })
          .catch(error => {
            processQueue(error, null)
            clearTokens()
            window.location.href = '/login'
            reject(error)
          })
          .finally(() => {
            isRefreshing = false
          })
      })
    }

    return Promise.reject(err)
  }
)

export default api
