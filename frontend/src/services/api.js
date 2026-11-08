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
