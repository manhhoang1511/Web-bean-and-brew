import type { OrderStatus, PaymentMethod } from '../api/types'

export const SHIPPING_FEE = 30_000
export const FREE_SHIPPING_THRESHOLD = 500_000

export const formatVND = (n: number) => n.toLocaleString('vi-VN') + 'đ'

export const formatShortVND = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace('.', ',') + 'tr'
  if (n >= 1000) return Math.round(n / 1000) + 'k'
  return String(n)
}

/** Backend trả datetime không kèm timezone (giờ local của server) */
export const formatDate = (iso: string, withTime = true) =>
  new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })

export const ORDER_STATUS: Record<OrderStatus, { label: string; className: string; dot: string }> = {
  pending: { label: 'Đang xử lý', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', dot: 'bg-amber-500' },
  shipping: { label: 'Đang giao', className: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200', dot: 'bg-sky-500' },
  completed: { label: 'Đã hoàn thành', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500' },
  cancelled: { label: 'Đã hủy', className: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200', dot: 'bg-rose-500' },
}

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  cod: 'Thanh toán khi nhận hàng',
  card: 'Thẻ tín dụng / ghi nợ',
  qr: 'Chuyển khoản QR',
}

export const PAYMENT_STATUS: Record<string, { label: string; className: string }> = {
  unpaid: { label: 'Chưa thanh toán', className: 'text-amber-700' },
  paid: { label: 'Đã thanh toán', className: 'text-emerald-700' },
  refunded: { label: 'Đã hoàn tiền', className: 'text-slate-500' },
}

export const discountPercent = (price: number, original: number | null) =>
  original && original > price ? Math.round((1 - price / original) * 100) : 0
