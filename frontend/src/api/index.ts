import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && err.config?.url !== '/auth/login') {
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// FastAPI 422 validation errors return detail as an array of objects.
// This extracts a readable string regardless of format.
export function extractApiError(e: unknown, fallback = 'An error occurred.'): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (typeof d === 'object' && d !== null && 'msg' in d ? String((d as { msg: unknown }).msg) : String(d)))
      .join('; ')
  }
  if (typeof detail === 'object' && detail !== null) {
    const obj = detail as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.msg === 'string') return obj.msg
    return JSON.stringify(detail)
  }
  return fallback
}
