import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { api, errorMessage } from '../../api/client'
import type { Topping } from '../../api/types'
import { ConfirmDialog, Modal, PageLoader, Spinner } from '../../components/ui'
import { formatVND } from '../../lib/format'
import { useDocumentTitle } from '../../lib/hooks'
import { AdminPageHeader } from './AdminLayout'

type Editing = { id: number | null; name: string; price: string; is_active: boolean }

export default function AdminToppings() {
  useDocumentTitle('Admin – Topping')
  const [items, setItems] = useState<Topping[] | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<Topping | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () => api.get<Topping[]>('/api/admin/toppings').then((r) => setItems(r.data))
  useEffect(() => { load() }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setBusy(true)
    const body = { name: editing.name, price: Number(editing.price || 0), is_active: editing.is_active }
    try {
      if (editing.id) await api.put(`/api/admin/toppings/${editing.id}`, body)
      else await api.post('/api/admin/toppings', body)
      toast.success('Đã lưu topping')
      setEditing(null)
      load()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (t: Topping) => {
    try {
      await api.put(`/api/admin/toppings/${t.id}`, { name: t.name, price: t.price, is_active: !t.is_active })
      toast.success(t.is_active ? `Đã tạm ngưng ${t.name}` : `Đã mở bán ${t.name}`)
      load()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await api.delete(`/api/admin/toppings/${deleting!.id}`)
      toast.success('Đã xóa topping')
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
      <AdminPageHeader title="Topping" desc="Áp dụng cho đồ uống bật “Cho thêm topping”. Giá cộng thêm vào mỗi ly."
        action={<button className="btn-primary" onClick={() => setEditing({ id: null, name: '', price: '', is_active: true })}><Plus size={18} /> Thêm topping</button>} />
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream-100/70 text-left text-xs uppercase tracking-wider text-coffee-500">
            <tr>
              <th className="px-4 py-3 font-medium">Topping</th>
              <th className="px-4 py-3 font-medium">Giá / phần</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-coffee-50">
            {items.map((t) => (
              <tr key={t.id} className={`hover:bg-cream-50 ${!t.is_active ? 'opacity-60' : ''}`}>
                <td className="px-4 py-3 font-medium">🧋 {t.name}</td>
                <td className="px-4 py-3 font-semibold">+{formatVND(t.price)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggle(t)} className={`chip cursor-pointer ${t.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-coffee-50 text-coffee-500'}`}>
                    {t.is_active ? 'Đang bán' : 'Tạm ngưng'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button className="rounded-lg p-2 text-coffee-500 hover:bg-coffee-50" aria-label="Sửa"
                      onClick={() => setEditing({ id: t.id, name: t.name, price: String(t.price), is_active: t.is_active })}><Pencil size={16} /></button>
                    <button className="rounded-lg p-2 text-coffee-500 hover:bg-rose-50 hover:text-rose-600" aria-label="Xóa" onClick={() => setDeleting(t)}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Sửa topping' : 'Thêm topping'}>
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <div><label className="label">Tên topping</label><input className="input" required minLength={2} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><label className="label">Giá mỗi phần (đ)</label><input className="input" type="number" min={0} required value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-caramel-500" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> Đang bán</label>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setEditing(null)}>Hủy</button>
              <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Lưu</button>
            </div>
          </form>
        )}
      </Modal>
      <ConfirmDialog open={!!deleting} title="Xóa topping?" danger loading={busy} confirmText="Xóa"
        message={<>Xóa <b>{deleting?.name}</b>? Đơn hàng cũ vẫn giữ tên và giá topping đã bán.</>}
        onConfirm={remove} onClose={() => setDeleting(null)} />
    </>
  )
}
