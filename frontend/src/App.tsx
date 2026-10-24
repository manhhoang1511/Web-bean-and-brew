import { lazy, Suspense } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import { EmptyState, PageLoader } from './components/ui'
import { useAuth } from './store/auth'
import Home from './pages/Home'
import Shop from './pages/Shop'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import { Login, Register } from './pages/Auth'
import { MyOrders, OrderDetail } from './pages/Orders'
import Profile from './pages/Profile'

// Trang admin tải riêng (code-splitting) để khách hàng không phải tải recharts
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'))
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'))
const AdminCategories = lazy(() => import('./pages/admin/AdminMisc').then((m) => ({ default: m.AdminCategories })))
const AdminCustomers = lazy(() => import('./pages/admin/AdminMisc').then((m) => ({ default: m.AdminCustomers })))
const AdminCoupons = lazy(() => import('./pages/admin/AdminMisc').then((m) => ({ default: m.AdminCoupons })))

/** Chặn trang cần đăng nhập; adminOnly chặn thêm theo role */
function RequireAuth({ children, adminOnly }: { children: React.ReactNode; adminOnly?: boolean }) {
  const user = useAuth((s) => s.user)
  const { pathname } = useLocation()
  if (!user) return <Navigate to={`/login?redirect=${encodeURIComponent(pathname)}`} replace />
  if (adminOnly && user.role !== 'admin') {
    return <EmptyState icon="🔒" title="Không có quyền truy cập" desc="Trang này chỉ dành cho quản trị viên." action={<Link to="/" className="btn-primary">Về trang chủ</Link>} />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <>
      <Toaster position="top-center" toastOptions={{ style: { borderRadius: 14, fontSize: 14 }, duration: 2500 }} />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="shop" element={<Shop />} />
            <Route path="products/:slug" element={<ProductDetail />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
            <Route path="orders" element={<RequireAuth><MyOrders /></RequireAuth>} />
            <Route path="orders/:code" element={<RequireAuth><OrderDetail /></RequireAuth>} />
            <Route path="profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="*" element={<EmptyState icon="☕" title="404 – Không tìm thấy trang" desc="Trang bạn tìm có thể đã bị xóa hoặc đổi đường dẫn." action={<Link to="/" className="btn-primary">Về trang chủ</Link>} />} />
          </Route>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="admin" element={<RequireAuth adminOnly><AdminLayout /></RequireAuth>}>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="coupons" element={<AdminCoupons />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  )
}
