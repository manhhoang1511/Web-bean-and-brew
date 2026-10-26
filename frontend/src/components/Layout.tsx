import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, Heart, LayoutDashboard, LogOut, Mail, MapPin, Menu, Package, Phone, Search, ShoppingBag, User as UserIcon, X } from 'lucide-react'
import { api, imageUrl } from '../api/client'
import type { Product } from '../api/types'
import { useAuth } from '../store/auth'
import { cartCount, useCart } from '../store/cart'
import { useWishlist } from '../store/wishlist'
import { formatVND } from '../lib/format'
import { useDebounce } from '../lib/hooks'
import ChatWidget from './ChatWidget'
import ThemeToggle from './ThemeToggle'
import { BackToTop, CustomCursor, Preloader, useRipple } from './effects/GlobalEffects'

export function Logo({ light }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-espresso-800">
        <svg viewBox="0 0 64 64" className="h-6 w-6"><ellipse cx="32" cy="32" rx="13" ry="18" fill="#d08a3c" transform="rotate(30 32 32)" /><path d="M26 18c8 6 4 22 12 28" stroke="#3b2a20" strokeWidth="3" fill="none" strokeLinecap="round" /></svg>
      </span>
      <span className={`whitespace-nowrap font-display text-xl font-bold ${light ? 'text-latte-50' : 'text-coffee-900'}`}>
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

function UserMenu({ overlay }: { overlay?: boolean }) {
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
      <Link to="/login" className={`hidden rounded-full px-5 sm:inline-flex ${overlay ? 'btn bg-white text-espresso-900 hover:bg-caramel-400' : 'btn-primary'}`}>
        Đăng nhập
      </Link>
    )
  }
  const item = 'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-coffee-50'
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-2 ${overlay ? 'hover:bg-white/15' : 'hover:bg-coffee-50'}`}>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-caramel-500 text-sm font-bold text-white">
          {user.full_name.charAt(0).toUpperCase()}
        </span>
        <span className={`hidden max-w-28 truncate text-sm font-medium lg:block ${overlay ? 'text-white' : ''}`}>{user.full_name}</span>
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
            <Link to="/wishlist" className={item}><Heart size={16} /> Yêu thích</Link>
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
  const wishCount = useWishlist((s) => s.ids.length)
  const { pathname, search } = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const [overDark, setOverDark] = useState(false)
  useEffect(() => {
    // Header đang nằm trên vùng nền tối (section có data-overlay-header) -> dùng giao diện kính mờ chữ trắng
    const onScroll = () => {
      setScrollY(window.scrollY)
      const zone = document.querySelector('[data-overlay-header]')
      setOverDark(!!zone && zone.getBoundingClientRect().bottom > 90)
    }
    onScroll()
    const t = setTimeout(onScroll, 50) // trang mới render xong mới có vùng tối
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { clearTimeout(t); window.removeEventListener('scroll', onScroll) }
  }, [pathname])

  const isHome = pathname === '/'
  const overlay = isHome && overDark
  const scrolled = scrollY > 8

  const links: [string, string][] = [
    ['/', 'Trang chủ'], ['/shop', 'Cửa hàng'], ['/shop?category=do-uong-pha-che', 'Đồ uống'],
    ['/shop?category=ca-phe-hat', 'Cà phê hạt'], ...(user ? [['/orders', 'Đơn hàng'] as [string, string]] : []),
  ]
  const isActive = (to: string) => (to.includes('?') ? pathname + search === to : pathname === to && (to !== '/shop' || !search))
  const icon = overlay ? 'text-white hover:bg-white/15' : 'text-coffee-700 hover:bg-coffee-50'
  const badgeRing = overlay ? 'ring-transparent' : 'ring-cream-50'

  return (
    <header className={
      overlay ? 'fixed inset-x-0 top-0 z-40 px-2 pt-2 sm:px-3 sm:pt-3'
        : `${isHome ? 'fixed inset-x-0 top-0 animate-header-in' : 'sticky top-0'} z-40 border-b bg-cream-50/85 backdrop-blur-lg transition ${scrolled ? 'border-coffee-100 shadow-sm' : 'border-transparent'}`
    }>
      <div className={`container-page flex h-16 items-center gap-4 lg:gap-6 ${overlay ? 'sm:h-20' : ''}`}>
        <button className={`-ml-2 rounded-lg p-2 md:hidden ${overlay ? 'text-white' : ''}`} onClick={() => setMobileOpen(true)} aria-label="Menu"><Menu size={22} /></button>
        <Logo light={overlay} />

        {overlay ? (
          // Thanh menu dạng "viên thuốc" kính mờ ở giữa như ảnh mẫu
          <nav className="mx-auto hidden items-center gap-1 rounded-full border border-white/15 bg-white/10 p-1.5 backdrop-blur-md md:flex">
            {links.map(([to, label]) => (
              <Link key={to} to={to} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${isActive(to) ? 'bg-white text-espresso-900' : 'text-white/85 hover:bg-white/15 hover:text-white'}`}>
                {label}
              </Link>
            ))}
          </nav>
        ) : (
          <>
            <nav className="hidden items-center gap-6 md:flex">
              {links.slice(0, 2).concat(user ? [['/orders', 'Đơn hàng']] : []).map(([to, label]) => (
                <NavLink key={to} to={to} end className={({ isActive: a }) => `text-sm font-medium transition ${a ? 'text-caramel-600' : 'text-coffee-600 hover:text-coffee-900'}`}>{label}</NavLink>
              ))}
            </nav>
            <div className="hidden max-w-md flex-1 md:block"><SearchBox /></div>
          </>
        )}

        <div className={`flex items-center gap-1 sm:gap-2 ${overlay ? '' : 'ml-auto'}`}>
          {overlay && <Link to="/shop" className={`hidden rounded-full p-2.5 sm:block ${icon}`} aria-label="Tìm kiếm"><Search size={20} /></Link>}
          <ThemeToggle className={icon} />
          {user && (
            <Link to="/wishlist" className={`relative hidden rounded-full p-2.5 sm:block ${icon}`} aria-label="Yêu thích">
              <Heart size={22} />
              {wishCount > 0 && (
                <span className={`absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white ring-2 ${badgeRing}`}>
                  {wishCount}
                </span>
              )}
            </Link>
          )}
          <Link to="/cart" className={`relative rounded-full p-2.5 ${icon}`} aria-label="Giỏ hàng" data-cart-icon>
            <ShoppingBag size={22} />
            {count > 0 && (
              <span className={`absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-caramel-500 px-1 text-[11px] font-bold text-white ring-2 ${badgeRing}`}>
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
          <UserMenu overlay={overlay} />
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-espresso-900/40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="h-full w-80 max-w-[85vw] bg-cream-50 p-5 text-coffee-900 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <Logo />
              <button onClick={() => setMobileOpen(false)} aria-label="Đóng"><X /></button>
            </div>
            <SearchBox onDone={() => setMobileOpen(false)} />
            <nav className="mt-6 flex flex-col gap-1" onClick={() => setMobileOpen(false)}>
              {[['/', 'Trang chủ'], ['/shop', 'Cửa hàng'], ['/shop?category=do-uong-pha-che', 'Đồ uống'], ['/cart', 'Giỏ hàng'], ...(user ? [['/orders', 'Đơn hàng của tôi'], ['/wishlist', 'Yêu thích'], ['/profile', 'Tài khoản']] : [['/login', 'Đăng nhập'], ['/register', 'Đăng ký']])].map(([to, label]) => (
                <NavLink key={to} to={to} end className={({ isActive: a }) => `rounded-xl px-3 py-2.5 font-medium ${a ? 'bg-coffee-800 text-cream-50' : 'hover:bg-coffee-50'}`}>
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
    <footer className="mt-20 bg-espresso-900 text-latte-200">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-latte-300">
            Rang xay thủ công mỗi tuần từ những nông trại tốt nhất Tây Nguyên và thế giới. Giao tận nơi, giữ trọn hương vị.
          </p>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-latte-50">Khám phá</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/shop?category=ca-phe-hat" className="hover:text-caramel-400">Cà phê hạt</Link></li>
            <li><Link to="/shop?category=dung-cu-pha-che" className="hover:text-caramel-400">Dụng cụ pha chế</Link></li>
            <li><Link to="/shop?sort=bestseller" className="hover:text-caramel-400">Bán chạy nhất</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-semibold text-latte-50">Liên hệ</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2"><MapPin size={15} /> 123 Lê Lợi, Q.1, TP.HCM</li>
            <li className="flex items-center gap-2"><Phone size={15} /> 1900 1234</li>
            <li className="flex items-center gap-2"><Mail size={15} /> hello@beanbrew.vn</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-latte-400">
        © {new Date().getFullYear()} Bean & Brew · Đồ án Vibe Coding – Hệ thống bán hàng
      </div>
    </footer>
  )
}

/** Thanh mảnh trên cùng cho biết đã cuộn bao nhiêu % trang */
function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const on = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      ref.current?.style.setProperty('--progress', String(max > 0 ? window.scrollY / max : 0))
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on) }
  }, [])
  return <div ref={ref} className="scroll-progress fixed inset-x-0 top-0 z-[60] h-[3px] bg-gradient-to-r from-caramel-400 via-caramel-500 to-rose-400" aria-hidden />
}

export default function Layout() {
  const { pathname } = useLocation()
  const token = useAuth((s) => s.token)
  useRipple()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  // Đăng nhập -> tải danh sách yêu thích; đăng xuất -> xóa
  useEffect(() => {
    if (token) useWishlist.getState().load().catch(() => {})
    else useWishlist.getState().reset()
  }, [token])
  return (
    <div className="flex min-h-screen flex-col">
      <Preloader />
      <CustomCursor />
      <ScrollProgress />
      {/* Bộ lọc SVG cho hiệu ứng ảnh gợn như mặt nước (.liquid:hover img) */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <filter id="liquid">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="2" seed="3">
            <animate attributeName="baseFrequency" dur="7s" values="0.012 0.03;0.02 0.05;0.012 0.03" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="24" />
        </filter>
      </svg>
      <Header />
      <main className="flex-1">
        {/* key đổi theo đường dẫn -> mỗi lần chuyển trang chạy lại hiệu ứng xuất hiện */}
        <div key={pathname} className="animate-page"><Outlet /></div>
      </main>
      <Footer />
      <BackToTop />
      <ChatWidget />
    </div>
  )
}
