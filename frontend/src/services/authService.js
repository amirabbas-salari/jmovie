import api from './api'

export const login = async (username, password) => {
  const response = await api.post('/api/token/', {
    username,
    password,
  })
  return response.data
}

export const register = async (formData) => {
  // هدر را دستی ست نکنید: بدنه FormData است و axios باید خودش
  // multipart/form-data با boundary درست بفرستد. قبلاً هدر اشتباهِ
  // x-www-form-urlencoded ست می‌شد و فیلدها سمت سرور خراب می‌رسیدند.
  const response = await api.post('/accounts/register/', formData)
  return response.data
}
