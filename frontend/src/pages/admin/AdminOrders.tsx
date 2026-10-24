import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { CheckCircle2, Eye, Receipt, Search, Truck, XCircle } from 'lucide-react'
import { api, errorMessage, imageUrl } from '../../api/client'
import type { Order, OrderStatus, Page } from '../../api/types'
import { EmptyState, Modal, Pagination, Spinner, StatusBadge } from '../../components/ui'
import { ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS, formatDate, formatVND } from '../../lib/format'
import { useDebounce, useDocumentTitle } from '../../lib/hooks'
import { AdminPageHeader } from './AdminLayout'
import { useAdminEvents } from '../../store/adminEvents'
import ExportOrdersButton from './ExportOrdersButton'

// Khớp với ALLOWED_TRANSITIONS ở backend
const NEXT_ACTIONS: Record<OrderStatus, { to: OrderStatus; label: string; icon: typeof Truck; cls: string }[]> = {
  pending: [
    { to: 'shipping', label: 'Giao hàng', icon: Truck, cls: 'btn-primary' },
    { to: 'cancelled', label: 'Hủy', icon: XCircle, cls: 'btn-outline text-rose-600' },
  ],
  shipping: [
    { to: 'completed', label: 'Hoàn thành', icon: CheckCircle2, cls: 'btn bg-emerald-600 text-white hover:bg-emerald-700' },
    { to: 'cancelled', label: 'Hủy', icon: XCircle, cls: 'btn-outline text-rose-600' },
  ],
  completed: [],
  cancelled: [],
}

function Actions({ order, onUpdated, size = 'sm' }: { order: Order; onUpdated: (o: Order) => void; size?: 'sm' | 'md' }) {
  const [busy, setBusy] = useState<OrderStatus | null>(null)
  const update = async (to: OrderStatus) => {
    if (to === 'cancelled' && !window.confirm(`Hủy đơn #${order.code}? Tồn kho sẽ được hoàn lại.`)) return
    setBusy(to)
    try {
      const { data } = await api.patch<Order>(`/api/admin/orders/${order.id}/status`, { status: to })
      onUpdated(data)
      toast.success(`Đơn #${order.code}: ${ORDER_STATUS[to].label}`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="flex gap-1.5">
      {NEXT_ACTIONS[order.status].map(({ to, label, icon: Icon, cls }) => (
        <button key={to} className={`${cls} ${size === 'sm' ? 'px-2.5 py-1.5 text-xs' : ''}`} disabled={!!busy} onClick={() => update(to)}>
          {busy === to ? <Spinner className="h-3.5 w-3.5" /> : <Icon size={size === 'sm' ? 14 : 16} />} {label}
        </button>
      ))}
    </div>
  )
}

export default function AdminOrders() {
  useDocumentTitle('Admin – Đơn hàng')
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? '') as OrderStatus | ''
  const [data, setData] = useState<Page<Order> | null>(null)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [viewing, setViewing] = useState<Order | null>(null)
  const dq = useDebounce(q, 300)
  const version = useAdminEvents((s) => s.version)

  useEffect(() => { setPage(1) }, [status, dq])
  useEffect(() => {
    api.get<Page<Order>>('/api/admin/orders', { params: { status: status || undefined, q: dq || undefined, page, page_size: 10 } })
      .then((r) => setData(r.data))
  }, [status, dq, page, version])

  const onUpdated = (o: Order) => {
    setData((d) => d && { ...d, items: d.items.map((x) => (x.id === o.id ? o : x)) })
    if (viewing?.id === o.id) setViewing(o)
  }

  const tabs: [OrderStatus | '', string][] = [['', 'Tất cả'], ...(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => [s, ORDER_STATUS[s].label] as [OrderStatus, string])]

  return (
    <>
      <AdminPageHeader title="Đơn hàng" desc={data ? `${data.total} đơn hàng` : ''} action={<ExportOrdersButton status={status} />} />

      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1 rounded-xl bg-coffee-50 p-1">
            {tabs.map(([s, label]) => (
              <button key={s} onClick={() => setParams(s ? { status: s } : {})}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${status === s ? 'bg-surface text-coffee-900 shadow-sm' : 'text-coffee-500 hover:text-coffee-800'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto min-w-60 flex-1 sm:max-w-xs">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-coffee-300" />
            <input className="input pl-9" placeholder="Mã đơn, tên, SĐT, email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream-100/70 text-left text-xs uppercase tracking-wider text-coffee-500">
              <tr>
                <th className="px-4 py-3 font-medium">Mã đơn</th>
                <th className="px-4 py-3 font-medium">Khách hàng</th>
                <th className="px-4 py-3 font-medium">Ngày đặt</th>
                <th className="px-4 py-3 font-medium">Thanh toán</th>
                <th className="px-4 py-3 font-medium">Tổng tiền</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 text-right font-medium">Cập nhật</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-coffee-50">
              {data?.items.map((o) => (
                <tr key={o.id} className="hover:bg-cream-50">
                  <td className="px-4 py-3">
                    <button onClick={() => setViewing(o)} className="flex items-center gap-1.5 font-mono text-xs font-semibold hover:text-caramel-600">
                      #{o.code} <Eye size={13} className="text-coffee-300" />
                    </button>
                    <p className="text-xs text-coffee-400">{o.items.length} sản phẩm</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{o.shipping_name}</p>
                    <p className="text-xs text-coffee-400">{o.shipping_phone}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-coffee-500">{formatDate(o.created_at)}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs uppercase text-coffee-500">{o.payment_method}</p>
                    <p className={`text-xs font-medium ${PAYMENT_STATUS[o.payment_status].className}`}>{PAYMENT_STATUS[o.payment_status].label}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold">{formatVND(o.total)}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3"><div className="flex justify-end"><Actions order={o} onUpdated={onUpdated} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.items.length === 0 && <EmptyState icon={<Receipt size={28} />} title="Không có đơn hàng" />}
        {data && data.pages > 1 && <div className="border-t border-coffee-50 p-4"><Pagination page={data.page} pages={data.pages} onChange={setPage} /></div>}
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Đơn hàng #${viewing?.code}`} wide>
        {viewing && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3"><StatusBadge status={viewing.status} /><span className="text-coffee-400">{formatDate(viewing.created_at)}</span></div>
              <Actions order={viewing} onUpdated={onUpdated} size="md" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-cream-100 p-4">
                <p className="mb-1 text-xs font-semibold uppercase text-coffee-400">Giao đến</p>
                <p className="font-medium">{viewing.shipping_name} · {viewing.shipping_phone}</p>
                <p className="text-coffee-600">{viewing.shipping_address}</p>
                {viewing.note && <p className="mt-1 italic text-coffee-500">“{viewing.note}”</p>}
              </div>
              <div className="rounded-xl bg-cream-100 p-4">
                <p className="mb-1 text-xs font-semibold uppercase text-coffee-400">Tài khoản & thanh toán</p>
                <p className="font-medium">{viewing.user?.email}</p>
                <p className="text-coffee-600">{PAYMENT_METHOD[viewing.payment_method]}</p>
                <p className={`font-medium ${PAYMENT_STATUS[viewing.payment_status].className}`}>{PAYMENT_STATUS[viewing.payment_status].label}</p>
              </div>
            </div>
            <div className="divide-y divide-coffee-50 rounded-xl border border-coffee-100">
              {viewing.items.map((i) => (
                <div key={i.id} className="flex items-center gap-3 p-3">
                  <img src={imageUrl(i.product_image)} alt="" className="h-11 w-11 rounded-lg object-cover" />
                  <div className="flex-1">
                    <p className="font-medium">{i.product_name}</p>
                    {i.variant_label && <p className="text-xs text-coffee-400">{i.variant_label}</p>}
                  </div>
                  <p className="text-coffee-500">{formatVND(i.unit_price)} × {i.quantity}</p>
                  <p className="w-24 text-right font-semibold">{formatVND(i.line_total)}</p>
                </div>
              ))}
            </div>
            <dl className="ml-auto max-w-xs space-y-1">
              <div className="flex justify-between"><dt className="text-coffee-500">Tạm tính</dt><dd>{formatVND(viewing.subtotal)}</dd></div>
              {viewing.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Giảm ({viewing.coupon_code})</dt><dd>-{formatVND(viewing.discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-coffee-500">Vận chuyển</dt><dd>{formatVND(viewing.shipping_fee)}</dd></div>
              <div className="flex justify-between border-t border-coffee-100 pt-2 text-base font-bold"><dt>Tổng</dt><dd>{formatVND(viewing.total)}</dd></div>
            </dl>
          </div>
        )}
      </Modal>
    </>
  )
}
