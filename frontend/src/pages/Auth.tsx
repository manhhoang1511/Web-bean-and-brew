import { useState, type CSSProperties } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'
import { api, errorMessage } from '../api/client'
import type { User } from '../api/types'
import { Logo } from '../components/Layout'
import { Spinner } from '../components/ui'
import { useAuth } from '../store/auth'
import { useDocumentTitle } from '../lib/hooks'

const SIDE_IMG = 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1000&q=80&auto=format&fit=crop'

/** Khung trang đăng nhập/đăng ký: nửa trái tối kiểu tạp chí (đồng bộ trang chủ), nửa phải là form */
function AuthShell({ title, subtitle, children }: { title: string; subtitle: React.ReactNode; children: React.ReactNode }) {
  const line = (l: number) => ({ '--l': l }) as CSSProperties
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative isolate hidden overflow-hidden bg-espresso-900 text-latte-50 lg:flex lg:flex-col lg:justify-between lg:p-14">
        <img src={SIDE_IMG} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-45 animate-kenburns" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-espresso-900 via-espresso-900/50 to-espresso-900/70" />
        <div className="grain pointer-events-none absolute inset-0" aria-hidden />
        <Logo light />
        <div>
          <p className="editorial-line flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.35em] text-caramel-400" style={line(0)}>
            <span className="h-px w-10 bg-caramel-400" /> Bean & Brew — Since 2024
          </p>
          <h2 className="mt-6 font-display text-[clamp(3rem,4.6vw,5.5rem)] font-semibold leading-[0.98] tracking-tight">
            {[<>Cuộc sống</>, <>bắt đầu sau</>, <em key="e" className="font-normal italic text-caramel-400">tách đầu tiên.</em>].map((t, i) => (
              <span key={i} className="-mt-[0.15em] block overflow-hidden pb-[0.1em] pt-[0.15em]"><span className="editorial-line block" style={line(i + 1)}>{t}</span></span>
            ))}
          </h2>
          <div className="editorial-line mt-10 flex gap-10 border-t border-white/15 pt-6" style={line(5)}>
            {[['30+', 'Hộ nông dân'], ['5kg', 'Mỗi mẻ rang'], ['48h', 'Giao tận nhà']].map(([n, l]) => (
              <div key={l}><p className="font-display text-3xl font-semibold">{n}</p><p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-latte-300">{l}</p></div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-12 sm:px-10">
        <div className="w-full max-w-md animate-slide-up">
          <div className="lg:hidden"><Logo /></div>
          <Link to="/" className="link-underline hidden text-xs font-semibold uppercase tracking-[0.22em] text-coffee-400 hover:text-coffee-800 lg:inline">← Về trang chủ</Link>
          <h1 className="mt-10 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-3 text-sm text-coffee-500">{subtitle}</p>
          <div className="mt-10">{children}</div>
        </div>
      </div>
    </div>
  )
}

function PasswordInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input id={id} type={show ? 'text' : 'password'} className="input pr-10" value={value} onChange={(e) => onChange(e.target.value)} required minLength={6} />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-coffee-300 hover:text-coffee-600" aria-label="Hiện mật khẩu">
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}

function useAuthSubmit(path: string) {
  const setAuth = useAuth((s) => s.setAuth)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const submit = async (body: object, welcome: (u: User) => string) => {
    setLoading(true)
    try {
      const { data } = await api.post<{ access_token: string; user: User }>(path, body)
      setAuth(data.access_token, data.user)
      toast.success(welcome(data.user))
      const redirect = params.get('redirect')
      navigate(redirect ?? (data.user.role === 'admin' ? '/admin' : '/'), { replace: true })
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }
  return { submit, loading, redirect: params.get('redirect') }
}

export function Login() {
  useDocumentTitle('Đăng nhập')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { submit, loading, redirect } = useAuthSubmit('/api/auth/login')

  return (
    <AuthShell title="Chào mừng trở lại." subtitle={<>Chưa có tài khoản? <Link to={`/register${redirect ? `?redirect=${redirect}` : ''}`} className="font-semibold text-caramel-600 hover:underline">Đăng ký ngay</Link></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit({ email, password }, (u) => `Xin chào, ${u.full_name}!`) }}>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="password">Mật khẩu</label>
            <Link to="/forgot-password" className="mb-1.5 text-xs font-medium text-caramel-600 hover:underline">Quên mật khẩu?</Link>
          </div>
          <PasswordInput id="password" value={password} onChange={setPassword} />
        </div>
        <button className="btn-primary w-full py-3.5" disabled={loading}>{loading && <Spinner className="h-4 w-4" />} Đăng nhập</button>
      </form>
      <div className="mt-8 rounded-2xl border border-dashed border-coffee-200 bg-cream-100 p-4 text-xs text-coffee-600">
        <p className="mb-2 font-semibold">Tài khoản demo (bấm để điền):</p>
        {[['admin@beanbrew.vn', 'admin123', 'Quản trị viên'], ['user@beanbrew.vn', 'user123', 'Khách hàng']].map(([e, p, role]) => (
          <button key={e} type="button" onClick={() => { setEmail(e); setPassword(p) }} className="block w-full rounded-lg px-2 py-1 text-left hover:bg-surface">
            <b>{role}:</b> {e} / {p}
          </button>
        ))}
      </div>
    </AuthShell>
  )
}

export function Register() {
  useDocumentTitle('Đăng ký')
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' })
  const [confirm, setConfirm] = useState('')
  const { submit, loading, redirect } = useAuthSubmit('/api/auth/register')

  return (
    <AuthShell title="Tạo tài khoản" subtitle={<>Đã có tài khoản? <Link to={`/login${redirect ? `?redirect=${redirect}` : ''}`} className="font-semibold text-caramel-600 hover:underline">Đăng nhập</Link></>}>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault()
        if (form.password !== confirm) return toast.error('Mật khẩu nhập lại không khớp')
        submit({ ...form, phone: form.phone || null }, () => 'Đăng ký thành công! Dùng mã WELCOME10 để giảm 10% đơn đầu 🎁')
      }}>
        <div>
          <label className="label" htmlFor="full_name">Họ và tên</label>
          <input id="full_name" className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required minLength={2} autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div>
          <label className="label" htmlFor="phone">Số điện thoại <span className="font-normal text-coffee-300">(tùy chọn)</span></label>
          <input id="phone" className="input" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="password">Mật khẩu</label>
            <PasswordInput id="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
          </div>
          <div>
            <label className="label" htmlFor="confirm">Nhập lại</label>
            <PasswordInput id="confirm" value={confirm} onChange={setConfirm} />
          </div>
        </div>
        <p className="text-xs text-coffee-400">Mật khẩu tối thiểu 6 ký tự.</p>
        <button className="btn-primary w-full py-3.5" disabled={loading}>{loading && <Spinner className="h-4 w-4" />} Đăng ký</button>
      </form>
    </AuthShell>
  )
}

export function ForgotPassword() {
  useDocumentTitle('Quên mật khẩu')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ message: string; demo_reset_url?: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/forgot-password', { email })
      setResult(data)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Quên mật khẩu?" subtitle={<>Nhớ ra rồi? <Link to="/login" className="font-semibold text-caramel-600 hover:underline">Đăng nhập</Link></>}>
      {result ? (
        <div className="space-y-4">
          <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">📧 {result.message}</p>
          {result.demo_reset_url && (
            <div className="rounded-xl border border-dashed border-coffee-200 bg-cream-100 p-4 text-sm">
              <p className="mb-2 text-coffee-600"><b>Chế độ demo</b> – không có máy chủ email nên liên kết hiển thị tại đây:</p>
              <Link to={result.demo_reset_url} className="btn-accent w-full">Mở liên kết đặt lại mật khẩu</Link>
            </div>
          )}
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <p className="text-sm text-coffee-500">Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu (hiệu lực 15 phút).</p>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <button className="btn-primary w-full py-3.5" disabled={loading}>{loading && <Spinner className="h-4 w-4" />} Gửi liên kết</button>
        </form>
      )}
    </AuthShell>
  )
}

export function ResetPassword() {
  useDocumentTitle('Đặt lại mật khẩu')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const token = params.get('token') ?? ''

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) return toast.error('Mật khẩu nhập lại không khớp')
    setLoading(true)
    try {
      await api.post('/api/auth/reset-password', { token, new_password: password })
      toast.success('Đã đặt lại mật khẩu. Hãy đăng nhập bằng mật khẩu mới!')
      navigate('/login', { replace: true })
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Đặt mật khẩu mới" subtitle="Liên kết chỉ dùng được một lần và hết hạn sau 15 phút.">
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="password">Mật khẩu mới</label>
          <PasswordInput id="password" value={password} onChange={setPassword} />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Nhập lại mật khẩu</label>
          <PasswordInput id="confirm" value={confirm} onChange={setConfirm} />
        </div>
        <button className="btn-primary w-full py-3.5" disabled={loading || !token}>{loading && <Spinner className="h-4 w-4" />} Lưu mật khẩu mới</button>
        {!token && <p className="text-sm text-rose-600">Thiếu mã đặt lại – hãy mở đúng liên kết được gửi.</p>}
      </form>
    </AuthShell>
  )
}
