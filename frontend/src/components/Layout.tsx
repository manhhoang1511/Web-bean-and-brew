import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, LayoutDashboard, LogOut, Mail, MapPin, Menu, Package, Phone, Search, ShoppingBag, User as UserIcon, X } from 'lucide-react'
import { api, imageUrl } from '../api/client'
import type { Product } from '../api/types'
import { useAuth } from '../store/auth'
import { cartCount, useCart } from '../store/cart'
import { formatVND } from '../lib/format'
import { useDebounce } from '../lib/hooks'
import ChatWidget from './ChatWidget'

export function Logo({ light }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-coffee-800">
        <svg viewBox="0 0 64 64" className="h-6 w-6"><ellipse cx="32" cy="32" rx="13" ry="18" fill="#d08a3c" transform="rotate(30 32 32)" /><path d="M26 18c8 6 4 22 12 28" stroke="#3b2a20" strokeWidth="3" fill="none" strokeLinecap="round" /></svg>
      </span>
      <span className={`font-display text-xl font-bold ${light ? 'text-cream-50' : 'text-coffee-900'}`}>
        Bean <span className="text-caramel-500">&</span> Brew
      </span>
    </Link>
  )
}

function SearchBox({ onDone }: { onDone?: () => void }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Product[]>([])
  const debounced = useDebounce(q.trim(), 250)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!debounced) return setResults([])
    let cancelled = false
    api.get<Product[]>('/api/products/suggest', { params: { q: debounced } })
      .then((r) => !cancelled && setResults(r.data))
      .catch(() => {})
    return () => { cancelled = true }
  }, [debounced])

  useEffect(() => {
    const close = (e: MouseEvent) => !boxRef.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setOpen(false)
    navigate(`/shop${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
    onDone?.()
  }

  return (
    <div ref={boxRef} className="relative w-full">
      <form onSubmit={submit}>
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-coffee-300" />
        <input
          className="input rounded-full bg-cream-100/70 pl-10"
          placeholder="Tìm cà phê, trà, dụng cụ…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
      </form>
      {open && debounced && (
        <div className="card absolute inset-x-0 top-full z-50 mt-2 overflow-hidden p-1.5 animate-fade-in">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-coffee-400">Không tìm thấy “{debounced}”</p>
          ) : (
            <>
              {results.map((p) => (
                <Link key={p.id} to={`/products/${p.slug}`} onClick={() => { setOpen(false); setQ(''); onDone?.() }}
                  className="flex items-center gap-3 rounded-xl p-2 hover:bg-coffee-50">
                  <img src={imageUrl(p.image_url)} alt="" className="h-11 w-11 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-coffee-400">{p.category?.name}</p>
                  </div>
                  <span className="text-sm font-semibold">{formatVND(p.price)}</span>
                </Link>
              ))}
              <button onClick={submit} className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-caramel-600 hover:bg-coffee-50">
                Xem tất cả kết quả cho “{debounced}” →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  if (!user) {
    return (
      <Link to="/login" className="btn-primary hidden rounded-full px-5 sm:inline-flex">
        Đăng nhập
      </Link>
    )
  }
  const item = 'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-coffee-50'
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-coffee-50">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-caramel-500 text-sm font-bold text-white">
          {user.full_name.charAt(0).toUpperCase()}
        </span>
        <span className="hidden max-w-28 truncate text-sm font-medium lg:block">{user.full_name}</span>
        <ChevronDown size={14} className="hidden text-coffee-400 lg:block" />
      </button>
      {open && (
        <div className="card absolute right-0 top-full z-50 mt-2 w-56 p-1.5 animate-fade-in" onClick={() => setOpen(false)}>
          <div className="border-b border-coffee-100 px-3 pb-2 pt-1">
            <p className="truncate text-sm font-semibold">{user.full_name}</p>
            <p className="truncate text-xs text-coffee-400">{user.email}</p>
          </div>
          <div className="pt-1">
            {user.role === 'admin' && (
              <Link to="/admin" className={`${item} font-medium text-caramel-600`}><LayoutDashboard size={16} /> Trang quản trị</Link>
            )}
            <Link to="/orders" className={item}><Package size={16} /> Đơn hàng của tôi</Link>
            <Link to="/profile" className={item}><UserIcon size={16} /> Tài khoản</Link>
            <button className={`${item} w-full text-rose-600`} onClick={() => { logout(); navigate('/') }}>
              <LogOut size={16} /> Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Header() {
  const count = useCart((s) => cartCount(s.items))
  const user = useAuth((s) => s.user)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const nav = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition ${isActive ? 'text-caramel-600' : 'text-coffee-600 hover:text-coffee-900'}`

  return (
    <header className={`sticky top-0 z-40 border-b bg-cream-50/85 backdrop-blur-lg transition ${scrolled ? 'border-coffee-100 shadow-sm' : 'border-transparent'}`}>
      <div className="container-page flex h-16 items-center gap-4 lg:gap-8">
        <button className="-ml-2 rounded-lg p-2 md:hidden" onClick={() => setMobileOpen(true)} aria-label="Menu"><Menu size={22} /></button>
        <Logo />
        <nav className="hidden items-center gap-6 md:flex">
          <NavLink to="/" end className={nav}>Trang chủ</NavLink>
          <NavLink to="/shop" className={nav}>Cửa hàng</NavLink>
          {user && <NavLink to="/orders" className={nav}>Đơn hàng</NavLink>}
        </nav>
        <div className="hidden max-w-md flex-1 md:block"><SearchBox /></div>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link to="/cart" className="relative rounded-full p-2.5 text-coffee-700 hover:bg-coffee-50" aria-label="Giỏ hàng">
            <ShoppingBag size={22} />
            {count > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-caramel-500 px-1 text-[11px] font-bold text-white ring-2 ring-cream-50">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
          <UserMenu />
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-coffee-900/40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="h-full w-80 max-w-[85vw] bg-cream-50 p-5 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <Logo />
              <button onClick={() => setMobileOpen(false)} aria-label="Đóng"><X /></button>
            </div>
            <SearchBox onDone={() => setMobileOpen(false)} />
            <nav className="mt-6 flex flex-col gap-1" onClick={() => setMobileOpen(false)}>
              {[['/', 'Trang chủ'], ['/shop', 'Cửa hàng'], ['/cart', 'Giỏ hàng'], ...(user ? [['/orders', 'Đơn hàng của tôi'], ['/profile', 'Tài khoản']] : [['/login', 'Đăng nhập'], ['/register', 'Đăng ký']])].map(([to, label]) => (
                <NavLink key={to} to={to} end className={({ isActive }) => `rounded-xl px-3 py-2.5 font-medium ${isActive ? 'bg-coffee-800 text-white' : 'hover:bg-coffee-50'}`}>
                  {label}
                </NavLink>
              ))}
              {user?.role === 'admin' && <NavLink to="/admin" className="rounded-xl px-3 py-2.5 font-medium text-caramel-600">Trang quản trị</NavLink>}
            </nav>
          </div>
        </div>
      )}
    </header>
  )
}

function Footer() {
  return (
    <footer className="mt-20 bg-coffee-900 text-coffee-200">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-coffee-300">
            Rang xay thủ công mỗi tuần từ những nông trại tốt nhất Tây Nguyên và thế giới. Giao tận nơi, giữ trọn hương vị.
          </p>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-cream-50">Khám phá</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/shop?category=ca-phe-hat" className="hover:text-caramel-400">Cà phê hạt</Link></li>
            <li><Link to="/shop?category=dung-cu-pha-che" className="hover:text-caramel-400">Dụng cụ pha chế</Link></li>
            <li><Link to="/shop?sort=bestseller" className="hover:text-caramel-400">Bán chạy nhất</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-cream-50">Liên hệ</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2"><MapPin size={15} /> 123 Lê Lợi, Q.1, TP.HCM</li>
            <li className="flex items-center gap-2"><Phone size={15} /> 1900 1234</li>
            <li className="flex items-center gap-2"><Mail size={15} /> hello@beanbrew.vn</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-coffee-400">
        © {new Date().getFullYear()} Bean & Brew · Đồ án Vibe Coding – Hệ thống bán hàng
      </div>
    </footer>
  )
}

export default function Layout() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <ChatWidget />
    </div>
  )
}
