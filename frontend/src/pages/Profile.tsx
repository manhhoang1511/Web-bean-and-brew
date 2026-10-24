import { useState } from 'react'
import toast from 'react-hot-toast'
import { api, errorMessage } from '../api/client'
import type { User } from '../api/types'
import { Spinner } from '../components/ui'
import { useAuth } from '../store/auth'
import { formatDate } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'

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
  return (
    <div className="container-page max-w-3xl py-10">
      <div className="card flex items-center gap-5 p-6">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-caramel-500 text-2xl font-bold text-white">{user.full_name.charAt(0)}</span>
        <div>
          <h1 className="text-xl font-bold">{user.full_name}</h1>
          <p className="text-sm text-coffee-500">{user.email}</p>
          <p className="text-xs text-coffee-300">Thành viên từ {formatDate(user.created_at, false)}</p>
        </div>
      </div>

      <form onSubmit={saveInfo} className="card mt-6 space-y-4 p-6">
        <h2 className="text-lg font-semibold">Thông tin cá nhân</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Họ và tên</label><input className="input" value={info.full_name} onChange={(e) => setInfo({ ...info, full_name: e.target.value })} required minLength={2} /></div>
          <div><label className="label">Số điện thoại</label><input className="input" value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} /></div>
        </div>
        <div><label className="label">Địa chỉ mặc định</label><input className="input" value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} /></div>
        <button className="btn-primary" disabled={saving === 'info'}>{saving === 'info' && <Spinner className="h-4 w-4" />} Lưu thay đổi</button>
      </form>

      <form onSubmit={changePw} className="card mt-6 space-y-4 p-6">
        <h2 className="text-lg font-semibold">Đổi mật khẩu</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Mật khẩu hiện tại</label><input type="password" className="input" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required /></div>
          <div><label className="label">Mật khẩu mới</label><input type="password" className="input" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required minLength={6} /></div>
        </div>
        <button className="btn-outline" disabled={saving === 'pw'}>{saving === 'pw' && <Spinner className="h-4 w-4" />} Đổi mật khẩu</button>
      </form>
    </div>
  )
}
