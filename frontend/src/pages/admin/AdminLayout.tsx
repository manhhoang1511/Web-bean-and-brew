import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { BarChart3, Boxes, CupSoda, FolderTree, LogOut, Menu, Moon, Receipt, Store, Sun, TicketPercent, Users, X } from 'lucide-react'
import { api } from '../../api/client'
import { connectAdminStream, playChime } from '../../api/adminStream'
import type { Order, Page } from '../../api/types'
import { useAdminEvents } from '../../store/adminEvents'
import { useAuth } from '../../store/auth'
import { useTheme } from '../../store/theme'
import { formatVND } from '../../lib/format'

const NAV: { group: string; items: { to: string; label: string; icon: typeof BarChart3; end?: boolean }[] }[] = [
  { group: 'Bán hàng', items: [
    { to: '/admin', label: 'Tổng quan', icon: BarChart3, end: true },
    { to: '/admin/orders', label: 'Đơn hàng', icon: Receipt },
    { to: '/admin/customers', label: 'Khách hàng', icon: Users },
  ] },
  { group: 'Thực đơn', items: [
    { to: '/admin/products', label: 'Sản phẩm', icon: Boxes },
    { to: '/admin/categories', label: 'Danh mục', icon: FolderTree },
    { to: '/admin/toppings', label: 'Topping', icon: CupSoda },
  ] },
  { group: 'Khuyến mãi', items: [
    { to: '/admin/coupons', label: 'Mã giảm giá', icon: TicketPercent },
  ] },
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
    <div className="relative flex h-full flex-col overflow-hidden bg-espresso-900 text-latte-200">
      <div className="grain pointer-events-none absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-caramel-500/15 blur-3xl" />
      <Link to="/admin" className="relative px-6 pb-6 pt-7">
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <svg viewBox="0 0 64 64" className="h-6 w-6"><ellipse cx="32" cy="32" rx="13" ry="18" fill="#d08a3c" transform="rotate(30 32 32)" /><path d="M26 18c8 6 4 22 12 28" stroke="#3b2a20" strokeWidth="3" fill="none" strokeLinecap="round" /></svg>
          </span>
          <span className="font-display text-xl font-semibold text-latte-50">Bean <span className="italic text-caramel-400">&</span> Brew</span>
        </span>
        <span className="mt-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-latte-400"
          title={connected ? 'Đang nhận thông báo đơn hàng theo thời gian thực' : 'Đang kết nối lại…'}>
          <span className="relative flex h-2 w-2">
            {connected && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60" />}
            <span className={`relative h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-latte-400'}`} />
          </span>
          Quản trị · {connected ? 'Trực tuyến' : 'Đang kết nối…'}
        </span>
      </Link>
      <nav className="relative flex-1 space-y-6 overflow-y-auto px-3" onClick={onNavigate}>
        {NAV.map(({ group, items }) => (
          <div key={group}>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-latte-400/80">{group}</p>
            <div className="space-y-0.5">
              {items.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end}
                  className={({ isActive }) => `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white'}`}>
                  {({ isActive }) => (
                    <>
                      {/* vạch caramel đánh dấu mục đang mở */}
                      <span className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-caramel-400 transition ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                      <Icon size={18} className={isActive ? 'text-caramel-400' : ''} /> {label}
                      {to === '/admin/orders' && pending > 0 && (
                        <span className="ml-auto rounded-full bg-caramel-500 px-2 py-0.5 text-[11px] font-bold text-white">{pending}</span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="relative space-y-0.5 border-t border-white/10 p-3">
        <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-white/5 hover:text-white"><Store size={18} /> Xem cửa hàng</Link>
        <button onClick={toggleTheme} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-white/5 hover:text-white">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />} {theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
        </button>
        <div className="mt-2 flex items-center gap-3 rounded-2xl bg-white/5 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-caramel-500 font-display text-base font-semibold text-white">{user?.full_name.charAt(0)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-latte-50">{user?.full_name}</p>
            <p className="truncate text-xs text-latte-400">{user?.email}</p>
          </div>
          <button onClick={() => { logout(); navigate('/login') }} className="rounded-lg p-1.5 text-latte-300 hover:bg-white/10 hover:text-white" aria-label="Đăng xuất" title="Đăng xuất">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false)
  const pending = useAdminRealtime()
  return (
    <div className="min-h-screen bg-cream-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-white/5 lg:block"><Sidebar pending={pending} /></aside>
      {open && (
        <div className="fixed inset-0 z-50 bg-espresso-900/50 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-64" onClick={(e) => e.stopPropagation()}><Sidebar pending={pending} onNavigate={() => setOpen(false)} /></aside>
          <button className="absolute right-4 top-4 text-white" aria-label="Đóng"><X /></button>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center border-b border-coffee-100 bg-cream-50/85 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Menu"><Menu /></button>
          <span className="ml-3 font-display text-lg font-semibold">Bean <span className="italic text-caramel-500">&</span> Brew · Quản trị</span>
        </header>
        <main className="mx-auto max-w-[96rem] p-4 sm:p-6 lg:p-10"><Outlet /></main>
      </div>
    </div>
  )
}

export function AdminPageHeader({ title, desc, action, kicker = 'Quản trị' }: { title: string; desc?: React.ReactNode; action?: React.ReactNode; kicker?: string }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-coffee-100 pb-6">
      <div>
        <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-caramel-600">
          <span className="h-px w-8 bg-caramel-500" /> {kicker}
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        {desc && <p className="mt-2 text-sm text-coffee-500">{desc}</p>}
      </div>
      {action}
    </div>
  )
}
