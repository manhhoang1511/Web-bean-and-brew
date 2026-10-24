import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { BarChart3, Boxes, FolderTree, LogOut, Menu, Moon, Receipt, Store, Sun, TicketPercent, Users, X } from 'lucide-react'
import { api } from '../../api/client'
import { connectAdminStream, playChime } from '../../api/adminStream'
import type { Order, Page } from '../../api/types'
import { useAdminEvents } from '../../store/adminEvents'
import { useAuth } from '../../store/auth'
import { useTheme } from '../../store/theme'
import { formatVND } from '../../lib/format'

const NAV = [
  { to: '/admin', label: 'Tổng quan', icon: BarChart3, end: true },
  { to: '/admin/orders', label: 'Đơn hàng', icon: Receipt },
  { to: '/admin/products', label: 'Sản phẩm', icon: Boxes },
  { to: '/admin/categories', label: 'Danh mục', icon: FolderTree },
  { to: '/admin/customers', label: 'Khách hàng', icon: Users },
  { to: '/admin/coupons', label: 'Mã giảm giá', icon: TicketPercent },
]

/** Kết nối realtime + đếm đơn chờ xử lý (dùng chung cho sidebar) */
function useAdminRealtime() {
  const navigate = useNavigate()
  const { push, setConnected, version } = useAdminEvents()
  const [pending, setPending] = useState(0)

  useEffect(() => connectAdminStream((ev) => {
    push(ev)
    if (ev.type === 'new_order') {
      playChime()
      toast((t) => (
        <button className="text-left" onClick={() => { toast.dismiss(t.id); navigate('/admin/orders?status=pending') }}>
          <b>🛎️ Đơn hàng mới #{ev.code}</b>
          <span className="block text-xs text-coffee-500">{ev.customer} · {ev.items} sản phẩm · {formatVND(ev.total)}</span>
        </button>
      ), { duration: 6000 })
    } else if (ev.type === 'order_paid') {
      toast.success(`Đơn #${ev.code} đã thanh toán ${formatVND(ev.total)}`)
    } else {
      toast(`Khách đã hủy đơn #${ev.code}`, { icon: '↩️' })
    }
  }, setConnected), [push, setConnected, navigate])

  useEffect(() => {
    api.get<Page<Order>>('/api/admin/orders', { params: { status: 'pending', page_size: 1 } })
      .then((r) => setPending(r.data.total)).catch(() => {})
  }, [version])

  return pending
}

function Sidebar({ onNavigate, pending }: { onNavigate?: () => void; pending: number }) {
  const { user, logout } = useAuth()
  const connected = useAdminEvents((s) => s.connected)
  const { theme, toggle: toggleTheme } = useTheme()
  const navigate = useNavigate()
  return (
    <div className="flex h-full flex-col bg-espresso-900 text-latte-200">
      <Link to="/admin" className="flex items-center gap-2.5 px-6 py-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-caramel-500 font-display font-bold text-white">B</span>
        <div>
          <p className="font-display font-bold text-latte-50">Bean & Brew</p>
          <p className="flex items-center gap-1.5 text-xs text-latte-400" title={connected ? 'Đang nhận thông báo đơn hàng theo thời gian thực' : 'Đang kết nối lại…'}>
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-latte-400'}`} />
            {connected ? 'Realtime' : 'Đang kết nối…'}
          </p>
        </div>
      </Link>
      <nav className="flex-1 space-y-1 px-3" onClick={onNavigate}>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white'}`}>
            <Icon size={18} /> {label}
            {to === '/admin/orders' && pending > 0 && (
              <span className="ml-auto rounded-full bg-caramel-500 px-2 py-0.5 text-[11px] font-bold text-white">{pending}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-1 border-t border-white/10 p-3">
        <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-white/5 hover:text-white"><Store size={18} /> Xem cửa hàng</Link>
        <button onClick={toggleTheme} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-white/5 hover:text-white">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />} {theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
        </button>
        <button onClick={() => { logout(); navigate('/login') }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-white/5 hover:text-white">
          <LogOut size={18} /> Đăng xuất
        </button>
        <div className="flex items-center gap-3 px-3 pt-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-caramel-500 text-sm font-bold text-white">{user?.full_name.charAt(0)}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-latte-50">{user?.full_name}</p>
            <p className="truncate text-xs text-latte-400">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false)
  const pending = useAdminRealtime()
  return (
    <div className="min-h-screen bg-cream-100/60">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block"><Sidebar pending={pending} /></aside>
      {open && (
        <div className="fixed inset-0 z-50 bg-espresso-900/50 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-64" onClick={(e) => e.stopPropagation()}><Sidebar pending={pending} onNavigate={() => setOpen(false)} /></aside>
          <button className="absolute right-4 top-4 text-white" aria-label="Đóng"><X /></button>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center border-b border-coffee-100 bg-surface/80 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Menu"><Menu /></button>
          <span className="ml-3 font-display font-bold">Bean & Brew Admin</span>
        </header>
        <main className="p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  )
}

export function AdminPageHeader({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {desc && <p className="mt-0.5 text-sm text-coffee-500">{desc}</p>}
      </div>
      {action}
    </div>
  )
}
