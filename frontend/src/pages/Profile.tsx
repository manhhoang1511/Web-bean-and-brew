import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Heart, KeyRound, Package, UserRound } from 'lucide-react'
import { api, errorMessage } from '../api/client'
import type { User } from '../api/types'
import PageHero from '../components/PageHero'
import { Spinner } from '../components/ui'
import { useAuth } from '../store/auth'
import { formatDate } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'

/** Tiêu đề khối có biểu tượng tròn – đồng bộ với các trang khác */
function BlockTitle({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-4 border-b border-coffee-100 pb-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-coffee-50 text-caramel-600">{icon}</span>
      <div>
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        <p className="text-sm text-coffee-500">{desc}</p>
      </div>
    </div>
  )
}

export default function Profile() {
  useDocumentTitle('Tài khoản')
  const { user, setUser } = useAuth()
  const [info, setInfo] = useState({ full_name: user?.full_name ?? '', phone: user?.phone ?? '', address: user?.address ?? '' })
  const [pw, setPw] = useState({ current_password: '', new_password: '' })
  const [saving, setSaving] = useState<'' | 'info' | 'pw'>('')

  const saveInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving('info')
    try {
      const { data } = await api.put<User>('/api/auth/me', info)
      setUser(data)
      toast.success('Đã lưu thông tin')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving('')
    }
  }

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving('pw')
    try {
      await api.post('/api/auth/change-password', pw)
      setPw({ current_password: '', new_password: '' })
      toast.success('Đã đổi mật khẩu')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving('')
    }
  }

  if (!user) return null
  const firstName = user.full_name.trim().split(/\s+/).pop()
  return (
    <div>
      <PageHero kicker={`Thành viên từ ${formatDate(user.created_at, false)}`} title={['Xin chào,', <em key="e">{firstName}.</em>]}
        subtitle={user.email}
        aside={
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-caramel-500 font-display text-5xl font-semibold text-white shadow-2xl shadow-caramel-500/30">
            {user.full_name.charAt(0).toUpperCase()}
          </span>
        }
        crumbs={[{ label: 'Tài khoản' }]}>
        <div className="flex flex-wrap gap-3">
          <Link to="/orders" className="btn border border-white/25 text-latte-50 hover:bg-white/10"><Package size={16} /> Đơn hàng của tôi</Link>
          <Link to="/wishlist" className="btn border border-white/25 text-latte-50 hover:bg-white/10"><Heart size={16} /> Yêu thích</Link>
        </div>
      </PageHero>

      <div className="container-page grid gap-14 pt-12 lg:grid-cols-2">
        <form onSubmit={saveInfo} className="space-y-5">
          <BlockTitle icon={<UserRound size={20} />} title="Thông tin cá nhân" desc="Dùng để điền sẵn khi bạn thanh toán." />
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Họ và tên</label><input className="input" value={info.full_name} onChange={(e) => setInfo({ ...info, full_name: e.target.value })} required minLength={2} /></div>
            <div><label className="label">Số điện thoại</label><input className="input" value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} /></div>
          </div>
          <div><label className="label">Địa chỉ mặc định</label><input className="input" value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} /></div>
          <button className="btn-primary" disabled={saving === 'info'}>{saving === 'info' && <Spinner className="h-4 w-4" />} Lưu thay đổi</button>
        </form>

        <form onSubmit={changePw} className="space-y-5">
          <BlockTitle icon={<KeyRound size={20} />} title="Đổi mật khẩu" desc="Mật khẩu mới tối thiểu 6 ký tự." />
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Mật khẩu hiện tại</label><input type="password" className="input" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required /></div>
            <div><label className="label">Mật khẩu mới</label><input type="password" className="input" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required minLength={6} /></div>
          </div>
          <button className="btn-outline" disabled={saving === 'pw'}>{saving === 'pw' && <Spinner className="h-4 w-4" />} Đổi mật khẩu</button>
        </form>
      </div>
    </div>
  )
}
