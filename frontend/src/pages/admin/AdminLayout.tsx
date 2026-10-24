import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { BarChart3, Boxes, FolderTree, LogOut, Menu, Receipt, Store, TicketPercent, Users, X } from 'lucide-react'
import { useAuth } from '../../store/auth'

const NAV = [
  { to: '/admin', label: 'Tổng quan', icon: BarChart3, end: true },
  { to: '/admin/orders', label: 'Đơn hàng', icon: Receipt },
  { to: '/admin/products', label: 'Sản phẩm', icon: Boxes },
  { to: '/admin/categories', label: 'Danh mục', icon: FolderTree },
  { to: '/admin/customers', label: 'Khách hàng', icon: Users },
  { to: '/admin/coupons', label: 'Mã giảm giá', icon: TicketPercent },
]

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="flex h-full flex-col bg-coffee-900 text-coffee-200">
      <Link to="/admin" className="flex items-center gap-2.5 px-6 py-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-caramel-500 font-display font-bold text-white">B</span>
        <div>
          <p className="font-display font-bold text-cream-50">Bean & Brew</p>
          <p className="text-xs text-coffee-400">Admin Dashboard</p>
        </div>
      </Link>
      <nav className="flex-1 space-y-1 px-3" onClick={onNavigate}>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white'}`}>
            <Icon size={18} /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-1 border-t border-white/10 p-3">
        <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-white/5 hover:text-white"><Store size={18} /> Xem cửa hàng</Link>
        <button onClick={() => { logout(); navigate('/login') }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-white/5 hover:text-white">
          <LogOut size={18} /> Đăng xuất
        </button>
        <div className="flex items-center gap-3 px-3 pt-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-caramel-500 text-sm font-bold text-white">{user?.full_name.charAt(0)}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-cream-50">{user?.full_name}</p>
            <p className="truncate text-xs text-coffee-400">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen bg-cream-100/60">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block"><Sidebar /></aside>
      {open && (
        <div className="fixed inset-0 z-50 bg-coffee-900/50 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-64" onClick={(e) => e.stopPropagation()}><Sidebar onNavigate={() => setOpen(false)} /></aside>
          <button className="absolute right-4 top-4 text-white" aria-label="Đóng"><X /></button>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center border-b border-coffee-100 bg-white/80 px-4 backdrop-blur lg:hidden">
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
