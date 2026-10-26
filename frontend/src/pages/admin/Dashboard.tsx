import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, DollarSign, ShoppingCart, TrendingUp, Users } from 'lucide-react'
import { api, imageUrl } from '../../api/client'
import type { OrderStatus, Stats } from '../../api/types'
import { PageLoader, StatusBadge } from '../../components/ui'
import { ORDER_STATUS, formatDate, formatShortVND, formatVND } from '../../lib/format'
import { useDocumentTitle } from '../../lib/hooks'
import { useAdminEvents } from '../../store/adminEvents'
import { useAuth } from '../../store/auth'
import { AdminPageHeader } from './AdminLayout'

const RANGES = [7, 14, 30]

/** Ngày hôm nay theo giờ máy (YYYY-MM-DD) – cột "hôm nay" chưa trọn ngày nên vẽ khác đi */
const todayKey = () => new Date().toLocaleDateString('sv-SE')
const BAR = '#b5702a' // đã kiểm tra tương phản trên nền sáng & tối (dataviz validate_palette)

function Kpi({ label, value, sub, icon: Icon, featured }: { label: string; value: string; sub?: string; icon: typeof DollarSign; featured?: boolean }) {
  return (
    <div className={`relative min-w-0 overflow-hidden rounded-[1.75rem] p-4 sm:p-6 ${featured ? 'col-span-2 bg-espresso-900 text-latte-50 xl:col-span-1' : 'card'}`}>
      {featured && <>
        <div className="grain pointer-events-none absolute inset-0" aria-hidden />
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-caramel-500/25 blur-3xl" />
      </>}
      <div className="relative flex items-center justify-between">
        <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${featured ? 'text-latte-300' : 'text-coffee-400'}`}>{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${featured ? 'bg-white/10 text-caramel-400' : 'bg-coffee-50 text-caramel-600'}`}><Icon size={17} /></span>
      </div>
      <p className={`relative mt-4 break-words font-display font-semibold tracking-tight tabular-nums ${featured ? 'text-4xl' : 'text-2xl sm:text-4xl'}`}>{value}</p>
      {sub && <p className={`relative mt-2 text-xs ${featured ? 'text-latte-300' : 'text-coffee-400'}`}>{sub}</p>}
    </div>
  )
}

function RevenueTooltip({ active, payload }: { active?: boolean; payload?: { payload: Stats['revenue_by_day'][number] }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl border border-coffee-100 bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-coffee-800">{formatDate(d.date, false)}{d.date === todayKey() && <span className="ml-1 font-normal text-coffee-400">· hôm nay, chưa hết ngày</span>}</p>
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
  const userName = useAuth((s) => s.user?.full_name ?? '')

  useEffect(() => {
    api.get<Stats>('/api/admin/stats', { params: { days } }).then((r) => setStats(r.data))
  }, [days, version])

  if (!stats) return <PageLoader />

  const rangeRevenue = stats.revenue_by_day.reduce((s, d) => s + d.revenue, 0)
  const statusTotal = Object.values(stats.orders_by_status).reduce((a, b) => a + b, 0) || 1
  const hour = new Date().getHours()
  const greeting = hour < 11 ? 'Chào buổi sáng' : hour < 14 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
  const today = todayKey()

  return (
    <>
      <AdminPageHeader kicker={`Bảng điều khiển · ${new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}`} title="Tổng quan"
        desc={<>{greeting}, <b className="text-coffee-800">{userName}</b> — số liệu cập nhật theo thời gian thực, lần cuối lúc {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}.</>} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Kpi featured label="Tổng doanh thu" value={formatVND(stats.total_revenue)} sub={`Hôm nay: ${formatVND(stats.revenue_today)}`} icon={DollarSign} />
        <Kpi label="Tổng đơn hàng" value={stats.total_orders.toLocaleString('vi-VN')} sub={`Hôm nay: ${stats.orders_today} đơn`} icon={ShoppingCart} />
        <Kpi label="Khách hàng" value={stats.total_customers.toLocaleString('vi-VN')} sub={`${stats.total_products} sản phẩm đang quản lý`} icon={Users} />
        <Kpi label="Giá trị TB / đơn" value={formatVND(stats.average_order_value)} sub="Không tính đơn đã hủy" icon={TrendingUp} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="card rounded-[1.75rem] p-6 xl:col-span-2">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold">Doanh thu theo ngày</h2>
              <p className="text-sm text-coffee-400">{days} ngày gần nhất: <b className="text-coffee-800">{formatVND(rangeRevenue)}</b></p>
            </div>
            <div className="flex rounded-full bg-coffee-50 p-1">
              {RANGES.map((r) => (
                <button key={r} onClick={() => setDays(r)}
                  className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${days === r ? 'bg-surface text-coffee-900 shadow-sm' : 'text-coffee-500'}`}>
                  {r} ngày
                </button>
              ))}
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              {/* Doanh thu từng ngày là đại lượng rời rạc -> dùng cột (đường cong làm người xem tưởng có giá trị giữa các ngày) */}
              <BarChart data={stats.revenue_by_day} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%">
                <defs>
                  {/* Hôm nay chưa hết ngày: cột nhạt + gạch chéo (không chỉ dựa vào màu) */}
                  <pattern id="today-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="6" height="6" fill={BAR} fillOpacity={0.25} />
                    <line x1="0" y1="0" x2="0" y2="6" stroke={BAR} strokeWidth="2" />
                  </pattern>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-cream-200)" />
                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(8, 10) + '/' + d.slice(5, 7)} tick={{ fontSize: 11, fill: 'var(--color-coffee-400)' }} axisLine={false} tickLine={false} minTickGap={12} />
                <YAxis tickFormatter={formatShortVND} tick={{ fontSize: 11, fill: 'var(--color-coffee-400)' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'var(--color-coffee-50)' }} />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                  {stats.revenue_by_day.map((d) => <Cell key={d.date} fill={d.date === today ? 'url(#today-hatch)' : BAR} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-coffee-400">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: `repeating-linear-gradient(45deg, ${BAR} 0 2px, ${BAR}40 2px 5px)` }} />
            Cột gạch chéo = hôm nay (chưa hết ngày)
          </p>
        </div>

        <div className="card rounded-[1.75rem] p-6">
          <h2 className="font-display text-xl font-semibold">Trạng thái đơn hàng</h2>
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
        <div className="card rounded-[1.75rem] p-6 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Đơn hàng gần đây</h2>
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
                    <td className="py-3 font-mono text-xs font-semibold"><Link to={`/admin/orders?q=${o.code}`} className="hover:text-caramel-600">#{o.code}</Link></td>
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
          <div className="card rounded-[1.75rem] p-6">
            <h2 className="mb-4 font-display text-xl font-semibold">Top bán chạy</h2>
            <div className="space-y-3">
              {stats.top_products.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="w-5 font-display text-lg italic text-caramel-500">{i + 1}</span>
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
          <div className="card rounded-[1.75rem] p-6">
            <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold"><AlertTriangle size={16} className="text-amber-500" /> Sắp hết hàng</h2>
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
