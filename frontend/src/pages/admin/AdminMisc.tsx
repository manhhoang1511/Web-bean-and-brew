import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { api, errorMessage } from '../../api/client'
import type { Category, Coupon, Customer } from '../../api/types'
import { ConfirmDialog, Modal, PageLoader, Spinner } from '../../components/ui'
import { formatDate, formatVND } from '../../lib/format'
import { useDocumentTitle } from '../../lib/hooks'
import { AdminPageHeader } from './AdminLayout'

// ---------------- Danh mục ----------------
export function AdminCategories() {
  useDocumentTitle('Admin – Danh mục')
  const [items, setItems] = useState<Category[] | null>(null)
  const [editing, setEditing] = useState<{ id: number | null; name: string; description: string; icon: string } | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => api.get<Category[]>('/api/categories').then((r) => setItems(r.data))
  useEffect(() => { load() }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setBusy(true)
    const body = { name: editing.name, description: editing.description || null, icon: editing.icon || null }
    try {
      if (editing.id) await api.put(`/api/admin/categories/${editing.id}`, body)
      else await api.post('/api/admin/categories', body)
      toast.success('Đã lưu danh mục')
      setEditing(null)
      load()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await api.delete(`/api/admin/categories/${deleting!.id}`)
      toast.success('Đã xóa danh mục')
      setDeleting(null)
      load()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!items) return <PageLoader />
  return (
    <>
      <AdminPageHeader kicker="Thực đơn" title="Danh mục" desc={`${items.length} danh mục`}
        action={<button className="btn-primary" onClick={() => setEditing({ id: null, name: '', description: '', icon: '☕' })}><Plus size={18} /> Thêm danh mục</button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((c) => (
          <div key={c.id} className="card flex items-start gap-4 p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cream-100 text-2xl">{c.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{c.name}</p>
              <p className="truncate text-sm text-coffee-400">{c.description || '—'}</p>
              <p className="mt-1 text-xs text-coffee-500">{c.product_count} sản phẩm · /{c.slug}</p>
            </div>
            <div className="flex gap-1">
              <button className="rounded-lg p-2 text-coffee-500 hover:bg-coffee-50" aria-label="Sửa"
                onClick={() => setEditing({ id: c.id, name: c.name, description: c.description ?? '', icon: c.icon ?? '' })}><Pencil size={16} /></button>
              <button className="rounded-lg p-2 text-coffee-500 hover:bg-rose-50 hover:text-rose-600" aria-label="Xóa" onClick={() => setDeleting(c)}><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Sửa danh mục' : 'Thêm danh mục'}>
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-[80px_1fr] gap-3">
              <div><label className="label">Icon</label><input className="input text-center text-xl" value={editing.icon} maxLength={4} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} /></div>
              <div><label className="label">Tên danh mục</label><input className="input" required minLength={2} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            </div>
            <div><label className="label">Mô tả</label><input className="input" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setEditing(null)}>Hủy</button>
              <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Lưu</button>
            </div>
          </form>
        )}
      </Modal>
      <ConfirmDialog open={!!deleting} title="Xóa danh mục?" danger loading={busy} confirmText="Xóa"
        message={<>Xóa <b>{deleting?.name}</b>? {deleting?.product_count ? `${deleting.product_count} sản phẩm sẽ chuyển sang "Không có danh mục".` : ''}</>}
        onConfirm={remove} onClose={() => setDeleting(null)} />
    </>
  )
}

// ---------------- Khách hàng ----------------
export function AdminCustomers() {
  useDocumentTitle('Admin – Khách hàng')
  const [items, setItems] = useState<Customer[] | null>(null)
  const [q, setQ] = useState('')
  useEffect(() => { api.get<Customer[]>('/api/admin/customers').then((r) => setItems(r.data)) }, [])
  if (!items) return <PageLoader />

  const term = q.toLowerCase()
  const shown = items.filter((c) => !term || c.full_name.toLowerCase().includes(term) || c.email.includes(term) || c.phone?.includes(term))

  return (
    <>
      <AdminPageHeader kicker="Bán hàng" title="Khách hàng" desc={`${items.length} khách hàng · Tổng chi tiêu ${formatVND(items.reduce((s, c) => s + c.total_spent, 0))}`} />
      <div className="card overflow-hidden">
        <div className="border-b border-coffee-50 p-4">
          <div className="relative max-w-xs">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-coffee-300" />
            <input className="input pl-9" placeholder="Tìm tên, email, SĐT…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream-100/70 text-left text-xs uppercase tracking-wider text-coffee-500">
              <tr><th className="px-4 py-3 font-medium">Khách hàng</th><th className="px-4 py-3 font-medium">Điện thoại</th><th className="px-4 py-3 font-medium">Ngày tham gia</th><th className="px-4 py-3 text-right font-medium">Số đơn</th><th className="px-4 py-3 text-right font-medium">Tổng chi tiêu</th></tr>
            </thead>
            <tbody className="divide-y divide-coffee-50">
              {shown.map((c) => (
                <tr key={c.id} className="hover:bg-cream-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-coffee-100 font-semibold text-coffee-700">{c.full_name.charAt(0)}</span>
                      <div><p className="font-medium">{c.full_name}</p><p className="text-xs text-coffee-400">{c.email}</p></div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-coffee-500">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-coffee-500">{formatDate(c.created_at, false)}</td>
                  <td className="px-4 py-3 text-right">{c.order_count}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatVND(c.total_spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ---------------- Mã giảm giá ----------------
export function AdminCoupons() {
  useDocumentTitle('Admin – Mã giảm giá')
  const [items, setItems] = useState<Coupon[] | null>(null)
  useEffect(() => { api.get<Coupon[]>('/api/admin/coupons').then((r) => setItems(r.data)) }, [])

  const toggle = async (c: Coupon) => {
    try {
      const { data } = await api.patch<Coupon>(`/api/admin/coupons/${c.id}/toggle`)
      setItems((list) => list!.map((x) => (x.id === c.id ? data : x)))
      toast.success(data.is_active ? `Đã bật mã ${c.code}` : `Đã tắt mã ${c.code}`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  if (!items) return <PageLoader />
  return (
    <>
      <AdminPageHeader kicker="Khuyến mãi" title="Mã giảm giá" desc="Khách nhập mã ở bước thanh toán; chatbot cũng tự giới thiệu các mã đang bật." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((c) => (
          <div key={c.id} className={`card relative overflow-hidden p-5 ${!c.is_active ? 'opacity-60' : ''}`}>
            <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-caramel-500/10" />
            <p className="font-mono text-lg font-bold tracking-wider">{c.code}</p>
            <p className="mt-1 text-sm text-coffee-500">{c.description}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="chip bg-caramel-500/10 text-caramel-600">-{c.discount_percent}%</span>
              {c.max_discount && <span className="chip bg-coffee-50 text-coffee-600">Tối đa {formatVND(c.max_discount)}</span>}
              {c.min_order > 0 && <span className="chip bg-coffee-50 text-coffee-600">Đơn từ {formatVND(c.min_order)}</span>}
            </div>
            <button onClick={() => toggle(c)} className={`mt-4 w-full ${c.is_active ? 'btn-outline' : 'btn-primary'}`}>
              {c.is_active ? 'Tắt mã' : 'Bật mã'}
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
