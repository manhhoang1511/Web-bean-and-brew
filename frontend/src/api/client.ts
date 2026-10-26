import axios, { AxiosError } from 'axios'
import { useAuth } from '../store/auth'

// baseURL rỗng: request đi qua proxy của Vite (/api -> FastAPI). Khi deploy có thể đặt VITE_API_URL.
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '' })

// Tự gắn JWT vào mọi request
api.interceptors.request.use((config) => {
  const token = useAuth.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Token hết hạn -> đăng xuất
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401 && useAuth.getState().token) {
      useAuth.getState().logout()
    }
    return Promise.reject(error)
  },
)

/** Lấy thông báo lỗi dễ đọc từ response của FastAPI */
export function errorMessage(err: unknown, fallback = 'Đã có lỗi xảy ra'): string {
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: unknown })?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && detail[0]?.msg) {
      const field = detail[0].loc?.slice(-1)[0]
      return `${field ? field + ': ' : ''}${detail[0].msg}`
    }
    if (!err.response) return 'Không kết nối được máy chủ'
  }
  return fallback
}

/** Ảnh upload lưu dạng /uploads/... -> nối với API base khi cần */
export function imageUrl(url: string | null | undefined): string {
  if (!url) url = '/static/media/u/1509042239860-f550ce710b93.jpg' // ảnh mặc định (đã tải sẵn)
  if (url.startsWith('/')) return (import.meta.env.VITE_API_URL ?? '') + url
  return url
}
