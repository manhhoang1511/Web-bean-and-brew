import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Check, CheckCircle2, ChevronRight, Package, Truck, XCircle } from 'lucide-react'
import { api, errorMessage, imageUrl } from '../api/client'
import type { Order, OrderStatus, Product } from '../api/types'
import { ConfirmDialog, EmptyState, PageLoader, Spinner, StatusBadge } from '../components/ui'
import { useCart } from '../store/cart'
import { PAYMENT_METHOD, PAYMENT_STATUS, formatDate, formatVND } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'

const TABS: [OrderStatus | '', string][] = [
  ['', 'Tất cả'], ['pending', 'Đang xử lý'], ['shipping', 'Đang giao'], ['completed', 'Hoàn thành'], ['cancelled', 'Đã hủy'],
]

export function MyOrders() {
  useDocumentTitle('Đơn hàng của tôi')
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [tab, setTab] = useState<OrderStatus | ''>('')

  useEffect(() => {
    api.get<Order[]>('/api/orders').then((r) => setOrders(r.data))
  }, [])

  const shown = orders?.filter((o) => !tab || o.status === tab) ?? []

  return (
    <div className="container-page max-w-4xl py-10">
      <h1 className="font-display text-3xl font-bold">Đơn hàng của tôi</h1>
      <div className="scrollbar-thin mt-6 flex gap-2 overflow-x-auto border-b border-coffee-100">
        {TABS.map(([key, label]) => {
          const n = key ? orders?.filter((o) => o.status === key).length : orders?.length
          return (
            <button key={key} onClick={() => setTab(key)}
              className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition ${tab === key ? 'border-caramel-500 text-caramel-600' : 'border-transparent text-coffee-500 hover:text-coffee-800'}`}>
              {label} {!!n && <span className="ml-1 text-xs text-coffee-300">({n})</span>}
            </button>
          )
        })}
      </div>

      {!orders ? <PageLoader /> : shown.length === 0 ? (
        <EmptyState icon={<Package size={30} />} title="Chưa có đơn hàng nào" action={<Link to="/shop" className="btn-primary">Mua sắm ngay</Link>} />
      ) : (
        <div className="mt-6 space-y-4">
          {shown.map((o) => (
            <Link key={o.id} to={`/orders/${o.code}`} className="card block p-5 transition hover:border-coffee-200 hover:shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <p className="font-mono font-semibold">#{o.code}</p>
                  <StatusBadge status={o.status} />
                </div>
                <p className="text-sm text-coffee-400">{formatDate(o.created_at)}</p>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex -space-x-3">
                  {o.items.slice(0, 4).map((i) => (
                    <img key={i.id} src={imageUrl(i.product_image)} alt="" className="h-12 w-12 rounded-lg border-2 border-white object-cover" />
                  ))}
                </div>
                <p className="flex-1 truncate text-sm text-coffee-600">
                  {o.items.map((i) => `${i.product_name} ×${i.quantity}`).join(', ')}
                </p>
                <div className="text-right">
                  <p className="text-xs text-coffee-400">Tổng tiền</p>
                  <p className="font-bold">{formatVND(o.total)}</p>
                </div>
                <ChevronRight size={18} className="text-coffee-300" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

const STEPS: { key: OrderStatus; label: string; icon: typeof Check }[] = [
  { key: 'pending', label: 'Đang xử lý', icon: Package },
  { key: 'shipping', label: 'Đang giao', icon: Truck },
  { key: 'completed', label: 'Đã hoàn thành', icon: CheckCircle2 },
]

function StatusTimeline({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-rose-50 p-4 text-rose-700">
        <XCircle size={22} /> <span className="font-semibold">Đơn hàng đã bị hủy</span>
      </div>
    )
  }
  const current = STEPS.findIndex((s) => s.key === status)
  return (
    <div className="flex items-center">
      {STEPS.map((s, i) => {
        const done = i <= current
        const Icon = s.icon
        return (
          <div key={s.key} className={`flex items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
            <div className="flex flex-col items-center gap-2">
              <span className={`flex h-11 w-11 items-center justify-center rounded-full transition ${done ? 'bg-caramel-500 text-white shadow-lg shadow-caramel-500/30' : 'bg-coffee-50 text-coffee-300'}`}>
                <Icon size={20} />
              </span>
              <span className={`whitespace-nowrap text-xs font-medium ${done ? 'text-coffee-900' : 'text-coffee-300'}`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`mx-2 mb-6 h-1 flex-1 rounded-full ${i < current ? 'bg-caramel-500' : 'bg-coffee-100'}`} />}
          </div>
        )
      })}
    </div>
  )
}

export function OrderDetail() {
  const { code } = useParams()
  const [params, setParams] = useSearchParams()
  const add = useCart((s) => s.add)
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const success = params.get('success') === '1'
  useDocumentTitle(`Đơn hàng #${code}`)

  useEffect(() => {
    api.get<Order>(`/api/orders/${code}`).then((r) => setOrder(r.data)).catch(() => setError(true))
  }, [code])

  const cancel = async () => {
    setCancelling(true)
    try {
      const { data } = await api.post<Order>(`/api/orders/${code}/cancel`)
      setOrder(data)
      toast.success('Đã hủy đơn hàng')
      setConfirmCancel(false)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setCancelling(false)
    }
  }

  const [paying, setPaying] = useState(false)
  const confirmPaid = async () => {
    setPaying(true)
    try {
      const { data } = await api.post<Order>(`/api/orders/${code}/pay`)
      setOrder(data)
      toast.success('Đã nhận thanh toán. Cảm ơn bạn!')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setPaying(false)
    }
  }

  const reorder = async () => {
    let added = 0
    for (const item of order!.items) {
      if (!item.product_id) continue
      try {
        const { data } = await api.get<Product>(`/api/products/${item.product_id}`)
        const variant = item.variant_id ? data.variants.find((v) => v.id === item.variant_id) ?? null : null
        if (data.variants.length && !variant) continue // phân loại cũ đã bị xóa
        const parts = item.variant_label?.split(' · ') ?? []
        const grind = data.has_grind_option ? parts.find((x) => x !== variant?.label) ?? 'Nguyên hạt' : null
        if ((variant?.stock ?? data.stock) > 0) { add(data, item.quantity, variant, grind); added++ }
      } catch { /* sản phẩm đã ngừng bán */ }
    }
    toast[added ? 'success' : 'error'](added ? `Đã thêm ${added} sản phẩm vào giỏ` : 'Các sản phẩm đã hết hàng')
  }

  if (error) return <EmptyState icon={<Package size={30} />} title="Không tìm thấy đơn hàng" action={<Link to="/orders" className="btn-primary">Về danh sách</Link>} />
  if (!order) return <PageLoader />

  const pay = PAYMENT_STATUS[order.payment_status]

  return (
    <div className="container-page max-w-4xl py-10">
      {success && (
        <div className="card mb-8 flex flex-col items-center p-8 text-center animate-slide-up">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Check size={34} strokeWidth={3} /></span>
          <h1 className="mt-4 font-display text-3xl font-bold">Đặt hàng thành công!</h1>
          <p className="mt-2 text-coffee-500">Cảm ơn bạn đã mua sắm tại Bean & Brew. Mã đơn hàng của bạn là <b className="font-mono text-coffee-900">#{order.code}</b></p>
          <div className="mt-6 flex gap-3">
            <Link to="/shop" className="btn-outline">Tiếp tục mua sắm</Link>
            <button className="btn-primary" onClick={() => setParams({})}>Xem chi tiết đơn</button>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/orders" className="text-sm text-coffee-400 hover:text-coffee-700">← Đơn hàng của tôi</Link>
          <h2 className="mt-1 font-display text-2xl font-bold">Đơn hàng <span className="font-mono">#{order.code}</span></h2>
          <p className="text-sm text-coffee-400">Đặt lúc {formatDate(order.created_at)}</p>
        </div>
        <div className="flex gap-2">
          {order.status === 'pending' && <button className="btn-outline text-rose-600" onClick={() => setConfirmCancel(true)}>Hủy đơn</button>}
          {(order.status === 'completed' || order.status === 'cancelled') && <button className="btn-primary" onClick={reorder}>Mua lại</button>}
        </div>
      </div>

      {order.payment_method === 'qr' && order.payment_status === 'unpaid' && order.status !== 'cancelled' && (
        <div className="card mb-6 flex flex-col items-center gap-5 border-2 border-caramel-500/40 p-6 sm:flex-row animate-slide-up">
          <img className="h-40 w-40 rounded-xl border border-coffee-100 bg-surface p-2"
            src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`BEANBREW|${order.code}|${order.total}`)}`} alt="Mã QR thanh toán" />
          <div className="flex-1 text-sm">
            <p className="chip mb-2 bg-amber-50 text-amber-700 ring-1 ring-amber-200">⏳ Chờ thanh toán</p>
            <p className="text-lg font-semibold">Quét mã để chuyển khoản</p>
            <dl className="mt-2 space-y-1 text-coffee-600">
              <div>Ngân hàng: <b className="text-coffee-900">Bean Bank (giả lập)</b> · STK <b className="text-coffee-900">0123 456 789</b></div>
              <div>Số tiền: <b className="text-caramel-600">{formatVND(order.total)}</b></div>
              <div>Nội dung: <b className="font-mono text-coffee-900">{order.code}</b></div>
            </dl>
            <button className="btn-accent mt-4" onClick={confirmPaid} disabled={paying}>
              {paying ? <Spinner className="h-4 w-4" /> : <Check size={16} />} Tôi đã chuyển khoản
            </button>
            <p className="mt-2 text-xs text-coffee-400">Môi trường demo: nút này giả lập ngân hàng báo đã nhận tiền.</p>
          </div>
        </div>
      )}

      <div className="card p-6"><StatusTimeline status={order.status} /></div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="card p-6 text-sm">
          <h3 className="mb-3 font-semibold">Thông tin giao hàng</h3>
          <p className="font-medium">{order.shipping_name}</p>
          <p className="text-coffee-500">{order.shipping_phone}</p>
          <p className="text-coffee-500">{order.shipping_address}</p>
          {order.note && <p className="mt-2 rounded-lg bg-cream-100 p-2 text-coffee-600">📝 {order.note}</p>}
        </div>
        <div className="card p-6 text-sm">
          <h3 className="mb-3 font-semibold">Thanh toán</h3>
          <p>{PAYMENT_METHOD[order.payment_method]}</p>
          <p className={`font-semibold ${pay.className}`}>{pay.label}</p>
          {order.coupon_code && <p className="mt-2 text-coffee-500">Mã giảm giá: <b>{order.coupon_code}</b></p>}
        </div>
      </div>

      <div className="card mt-6 p-6">
        <h3 className="mb-4 font-semibold">Sản phẩm</h3>
        <div className="divide-y divide-coffee-50">
          {order.items.map((i) => (
            <div key={i.id} className="flex items-center gap-4 py-3">
              <img src={imageUrl(i.product_image)} alt="" className="h-16 w-16 rounded-xl object-cover" />
              <div className="flex-1">
                {i.product_id ? (
                  <Link to={`/products/${i.product_id}`} className="font-medium hover:text-caramel-600">{i.product_name}</Link>
                ) : <p className="font-medium">{i.product_name}</p>}
                {i.variant_label && <p className="text-xs text-coffee-500">{i.variant_label}</p>}
                <p className="text-sm text-coffee-400">{formatVND(i.unit_price)} × {i.quantity}</p>
              </div>
              <p className="font-semibold">{formatVND(i.line_total)}</p>
            </div>
          ))}
        </div>
        <dl className="ml-auto mt-4 max-w-xs space-y-1.5 border-t border-coffee-100 pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-coffee-500">Tạm tính</dt><dd>{formatVND(order.subtotal)}</dd></div>
          {order.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Giảm giá</dt><dd>-{formatVND(order.discount)}</dd></div>}
          <div className="flex justify-between"><dt className="text-coffee-500">Phí giao hàng</dt><dd>{order.shipping_fee ? formatVND(order.shipping_fee) : 'Miễn phí'}</dd></div>
          <div className="flex justify-between pt-2 text-base"><dt className="font-semibold">Tổng cộng</dt><dd className="text-xl font-bold">{formatVND(order.total)}</dd></div>
        </dl>
      </div>

      <ConfirmDialog open={confirmCancel} title="Hủy đơn hàng?" danger loading={cancelling} confirmText="Hủy đơn"
        message={<>Bạn chắc chắn muốn hủy đơn <b>#{order.code}</b>? {order.payment_status === 'paid' && 'Số tiền đã thanh toán sẽ được hoàn lại.'}</>}
        onConfirm={cancel} onClose={() => setConfirmCancel(false)} />
    </div>
  )
}
