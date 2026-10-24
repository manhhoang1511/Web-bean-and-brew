import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, DollarSign, ShoppingCart, TrendingUp, Users } from 'lucide-react'
import { api, imageUrl } from '../../api/client'
import type { OrderStatus, Stats } from '../../api/types'
import { PageLoader, StatusBadge } from '../../components/ui'
import { ORDER_STATUS, formatDate, formatShortVND, formatVND } from '../../lib/format'
import { useDocumentTitle } from '../../lib/hooks'
import { useAdminEvents } from '../../store/adminEvents'
import { AdminPageHeader } from './AdminLayout'

const RANGES = [7, 14, 30]

function Kpi({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: typeof DollarSign }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-coffee-500">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-coffee-50 text-coffee-600"><Icon size={18} /></span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-coffee-400">{sub}</p>}
    </div>
  )
}

function RevenueTooltip({ active, payload }: { active?: boolean; payload?: { payload: Stats['revenue_by_day'][number] }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl border border-coffee-100 bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-coffee-800">{formatDate(d.date, false)}</p>
      <p className="mt-1 text-coffee-600">Doanh thu: <b className="text-coffee-900">{formatVND(d.revenue)}</b></p>
      <p className="text-coffee-600">Đơn hàng: <b className="text-coffee-900">{d.orders}</b></p>
    </div>
  )
}

export default function Dashboard() {
  useDocumentTitle('Admin – Tổng quan')
  const [days, setDays] = useState(14)
  const [stats, setStats] = useState<Stats | null>(null)
  const version = useAdminEvents((s) => s.version) // có đơn mới -> tải lại số liệu

  useEffect(() => {
    api.get<Stats>('/api/admin/stats', { params: { days } }).then((r) => setStats(r.data))
  }, [days, version])

  if (!stats) return <PageLoader />

  const rangeRevenue = stats.revenue_by_day.reduce((s, d) => s + d.revenue, 0)
  const statusTotal = Object.values(stats.orders_by_status).reduce((a, b) => a + b, 0) || 1

  return (
    <>
      <AdminPageHeader title="Tổng quan" desc={`Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Tổng doanh thu" value={formatVND(stats.total_revenue)} sub={`Hôm nay: ${formatVND(stats.revenue_today)}`} icon={DollarSign} />
        <Kpi label="Tổng đơn hàng" value={stats.total_orders.toLocaleString('vi-VN')} sub={`Hôm nay: ${stats.orders_today} đơn`} icon={ShoppingCart} />
        <Kpi label="Khách hàng" value={stats.total_customers.toLocaleString('vi-VN')} sub={`${stats.total_products} sản phẩm đang quản lý`} icon={Users} />
        <Kpi label="Giá trị TB / đơn" value={formatVND(stats.average_order_value)} sub="Không tính đơn đã hủy" icon={TrendingUp} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Doanh thu theo ngày</h2>
              <p className="text-sm text-coffee-400">{days} ngày gần nhất: <b className="text-coffee-800">{formatVND(rangeRevenue)}</b></p>
            </div>
            <div className="flex rounded-xl bg-coffee-50 p-1">
              {RANGES.map((r) => (
                <button key={r} onClick={() => setDays(r)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${days === r ? 'bg-surface text-coffee-900 shadow-sm' : 'text-coffee-500'}`}>
                  {r} ngày
                </button>
              ))}
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.revenue_by_day} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d08a3c" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#d08a3c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-cream-200)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(8, 10) + '/' + d.slice(5, 7)} tick={{ fontSize: 11, fill: 'var(--color-coffee-400)' }} axisLine={false} tickLine={false} minTickGap={16} />
                <YAxis tickFormatter={formatShortVND} tick={{ fontSize: 11, fill: 'var(--color-coffee-400)' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<RevenueTooltip />} cursor={{ stroke: 'var(--color-coffee-300)', strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="revenue" stroke="#b5702a" strokeWidth={2} fill="url(#rev)" isAnimationActive={false}
                  activeDot={{ r: 5, stroke: 'var(--color-surface)', strokeWidth: 2, fill: '#b5702a' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold">Trạng thái đơn hàng</h2>
          <p className="text-sm text-coffee-400">Tổng {stats.total_orders} đơn</p>
          <div className="mt-5 space-y-4">
            {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => {
              const n = stats.orders_by_status[s] ?? 0
              return (
                <Link to={`/admin/orders?status=${s}`} key={s} className="block rounded-lg transition hover:opacity-80" title={`${ORDER_STATUS[s].label}: ${n} đơn`}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-coffee-700"><span className={`h-2 w-2 rounded-full ${ORDER_STATUS[s].dot}`} /> {ORDER_STATUS[s].label}</span>
                    <span className="font-semibold text-coffee-900">{n} <span className="font-normal text-coffee-400">({Math.round((n / statusTotal) * 100)}%)</span></span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-coffee-50">
                    <div className={`h-full rounded-full ${ORDER_STATUS[s].dot}`} style={{ width: `${(n / statusTotal) * 100}%` }} />
                  </div>
                </Link>
              )
            })}
          </div>
          {stats.orders_by_status.pending > 0 && (
            <Link to="/admin/orders?status=pending" className="mt-6 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 hover:bg-amber-100">
              <AlertTriangle size={16} /> {stats.orders_by_status.pending} đơn đang chờ xử lý →
            </Link>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Đơn hàng gần đây</h2>
            <Link to="/admin/orders" className="text-sm font-medium text-caramel-600 hover:underline">Xem tất cả</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-coffee-400">
                <tr><th className="pb-3 font-medium">Mã đơn</th><th className="pb-3 font-medium">Khách hàng</th><th className="pb-3 font-medium">Thời gian</th><th className="pb-3 font-medium">Trạng thái</th><th className="pb-3 text-right font-medium">Tổng</th></tr>
              </thead>
              <tbody className="divide-y divide-coffee-50">
                {stats.recent_orders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-3 font-mono text-xs font-semibold">#{o.code}</td>
                    <td className="py-3">{o.user?.full_name}</td>
                    <td className="py-3 text-coffee-400">{formatDate(o.created_at)}</td>
                    <td className="py-3"><StatusBadge status={o.status} /></td>
                    <td className="py-3 text-right font-semibold">{formatVND(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-4 font-semibold">Top bán chạy</h2>
            <div className="space-y-3">
              {stats.top_products.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="w-4 text-sm font-bold text-coffee-300">{i + 1}</span>
                  <img src={imageUrl(p.image_url)} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-coffee-400">Đã bán {p.sold}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatShortVND(p.revenue)}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-semibold"><AlertTriangle size={16} className="text-amber-500" /> Sắp hết hàng</h2>
            <div className="space-y-2.5">
              {stats.low_stock.map((p) => (
                <Link key={p.id} to={`/admin/products?edit=${p.id}`} className="flex items-center justify-between text-sm hover:text-caramel-600">
                  <span className="truncate">{p.name}</span>
                  <span className={`chip ${p.stock === 0 ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{p.stock === 0 ? 'Hết hàng' : `Còn ${p.stock}`}</span>
                </Link>
              ))}
              {stats.low_stock.length === 0 && <p className="text-sm text-coffee-400">Tất cả sản phẩm đều đủ hàng 👍</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
