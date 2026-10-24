import { useState } from 'react'
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

function AuthShell({ title, subtitle, children }: { title: string; subtitle: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img src={SIDE_IMG} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-coffee-900/90 to-coffee-900/30" />
        <div className="absolute bottom-12 left-12 right-12 text-cream-50">
          <p className="font-display text-4xl font-bold leading-tight">“Cuộc sống bắt đầu sau tách cà phê đầu tiên.”</p>
          <p className="mt-3 text-coffee-200">— Bean & Brew</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm animate-slide-up">
          <Logo />
          <h1 className="mt-10 font-display text-3xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-coffee-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
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
    <AuthShell title="Chào mừng trở lại 👋" subtitle={<>Chưa có tài khoản? <Link to={`/register${redirect ? `?redirect=${redirect}` : ''}`} className="font-semibold text-caramel-600 hover:underline">Đăng ký ngay</Link></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit({ email, password }, (u) => `Xin chào, ${u.full_name}!`) }}>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="password">Mật khẩu</label>
          <PasswordInput id="password" value={password} onChange={setPassword} />
        </div>
        <button className="btn-primary w-full py-3" disabled={loading}>{loading && <Spinner className="h-4 w-4" />} Đăng nhập</button>
      </form>
      <div className="mt-8 rounded-xl border border-dashed border-coffee-200 bg-cream-100 p-4 text-xs text-coffee-600">
        <p className="mb-2 font-semibold">Tài khoản demo (bấm để điền):</p>
        {[['admin@beanbrew.vn', 'admin123', 'Quản trị viên'], ['user@beanbrew.vn', 'user123', 'Khách hàng']].map(([e, p, role]) => (
          <button key={e} type="button" onClick={() => { setEmail(e); setPassword(p) }} className="block w-full rounded-lg px-2 py-1 text-left hover:bg-white">
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
        <button className="btn-primary w-full py-3" disabled={loading}>{loading && <Spinner className="h-4 w-4" />} Đăng ký</button>
      </form>
    </AuthShell>
  )
}
