import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ImagePlus, Pencil, Plus, Search, Star, Trash2, Upload } from 'lucide-react'
import { api, errorMessage, imageUrl } from '../../api/client'
import type { Category, Page, Product } from '../../api/types'
import { ConfirmDialog, EmptyState, Modal, Pagination, Spinner } from '../../components/ui'
import { formatVND } from '../../lib/format'
import { useDebounce, useDocumentTitle } from '../../lib/hooks'
import { AdminPageHeader } from './AdminLayout'

type VariantRow = { id?: number; label: string; price: string; original_price: string; stock: string }

type FormState = {
  name: string; description: string; price: string; original_price: string; stock: string
  image_url: string; images: string; origin: string; roast_level: string; weight: string
  is_featured: boolean; is_active: boolean; category_id: string
  has_grind_option: boolean; is_drink: boolean; allow_toppings: boolean; variants: VariantRow[]
}

const EMPTY: FormState = {
  name: '', description: '', price: '', original_price: '', stock: '0', image_url: '', images: '',
  origin: '', roast_level: '', weight: '', is_featured: false, is_active: true, category_id: '',
  has_grind_option: false, is_drink: false, allow_toppings: false, variants: [],
}

const toForm = (p: Product): FormState => ({
  name: p.name, description: p.description, price: String(p.price), original_price: p.original_price ? String(p.original_price) : '',
  stock: String(p.stock), image_url: p.image_url, images: p.gallery.slice(1).join('\n'), origin: p.origin ?? '',
  roast_level: p.roast_level ?? '', weight: p.weight ?? '', is_featured: p.is_featured, is_active: p.is_active,
  category_id: p.category ? String(p.category.id) : '', has_grind_option: p.has_grind_option,
  is_drink: p.is_drink, allow_toppings: p.allow_toppings,
  variants: p.variants.map((v) => ({ id: v.id, label: v.label, price: String(v.price), original_price: v.original_price ? String(v.original_price) : '', stock: String(v.stock) })),
})

function VariantEditor({ rows, onChange }: { rows: VariantRow[]; onChange: (rows: VariantRow[]) => void }) {
  const update = (i: number, patch: Partial<VariantRow>) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  return (
    <div className="rounded-xl border border-coffee-100 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Phân loại (khối lượng, size…)</p>
          <p className="text-xs text-coffee-400">Có phân loại thì giá hiển thị = giá thấp nhất, tồn kho = tổng các phân loại.</p>
        </div>
        <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={() => onChange([...rows, { label: '', price: '', original_price: '', stock: '0' }])}>
          <Plus size={14} /> Thêm
        </button>
      </div>
      {rows.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_1fr_80px_32px] gap-2 text-xs font-medium text-coffee-400">
            <span>Tên (VD 500g)</span><span>Giá bán</span><span>Giá gốc</span><span>Tồn kho</span><span />
          </div>
          {rows.map((r, i) => (
            <div key={r.id ?? `new-${i}`} className="grid grid-cols-[1fr_1fr_1fr_80px_32px] gap-2">
              <input className="input px-2.5 py-2" required value={r.label} onChange={(e) => update(i, { label: e.target.value })} />
              <input className="input px-2.5 py-2" required type="number" min={1} value={r.price} onChange={(e) => update(i, { price: e.target.value })} />
              <input className="input px-2.5 py-2" type="number" min={1} value={r.original_price} onChange={(e) => update(i, { original_price: e.target.value })} />
              <input className="input px-2.5 py-2" required type="number" min={0} value={r.stock} onChange={(e) => update(i, { stock: e.target.value })} />
              <button type="button" className="rounded-lg text-coffee-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => onChange(rows.filter((_, idx) => idx !== i))} aria-label="Xóa phân loại">
                <Trash2 size={15} className="mx-auto" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-coffee-200'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition ${checked ? 'left-5.5' : 'left-0.5'}`} />
    </button>
  )
}

function ProductForm({ initial, categories, onSaved, onCancel, productId }: {
  initial: FormState; categories: Category[]; productId: number | null; onSaved: () => void; onCancel: () => void
}) {
  const [f, setF] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }))

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const { data } = await api.post<{ url: string }>('/api/admin/upload', body)
      set('image_url', data.url)
      toast.success('Đã tải ảnh lên')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...f,
      price: Number(f.price),
      original_price: f.original_price ? Number(f.original_price) : null,
      stock: Number(f.stock || 0),
      category_id: f.category_id ? Number(f.category_id) : null,
      images: f.images.split('\n').map((s) => s.trim()).filter(Boolean),
      origin: f.origin || null, roast_level: f.roast_level || null, weight: f.weight || null,
      variants: f.variants.map((v) => ({
        id: v.id, label: v.label, price: Number(v.price), stock: Number(v.stock || 0),
        original_price: v.original_price ? Number(v.original_price) : null,
      })),
    }
    // Có phân loại: giá/tồn kho chung do server tính lại, gửi giá trị hợp lệ tạm thời
    if (f.variants.length) {
      payload.price = Math.min(...payload.variants.map((v) => v.price))
      payload.stock = 0
    }
    try {
      if (productId) await api.put(`/api/admin/products/${productId}`, payload)
      else await api.post('/api/admin/products', payload)
      toast.success(productId ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm')
      onSaved()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const input = (k: keyof FormState, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label">{label}</label>
      <input className="input" value={f[k] as string} onChange={(e) => set(k, e.target.value as never)} {...props} />
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
        <div>
          <label className="label">Ảnh chính</label>
          <label className="group relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-coffee-200 bg-cream-100 hover:border-caramel-500">
            {f.image_url ? <img src={imageUrl(f.image_url)} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="text-coffee-300" size={32} />}
            <span className="absolute inset-0 flex items-center justify-center bg-espresso-900/50 text-sm font-medium text-white opacity-0 transition group-hover:opacity-100">
              {uploading ? <Spinner /> : <><Upload size={16} className="mr-1" /> Tải ảnh</>}
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        </div>
        <div className="space-y-4">
          {input('name', 'Tên sản phẩm *', { required: true, minLength: 2 })}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Danh mục</label>
              <select className="input" value={f.category_id} onChange={(e) => set('category_id', e.target.value)}>
                <option value="">— Không có —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {f.variants.length ? (
              <div><label className="label">Tồn kho</label><p className="input bg-cream-100 text-coffee-400">Theo phân loại</p></div>
            ) : input('stock', 'Tồn kho *', { type: 'number', min: 0, required: true })}
          </div>
          {!f.variants.length && (
            <div className="grid grid-cols-2 gap-4">
              {input('price', 'Giá bán (đ) *', { type: 'number', min: 1, required: true })}
              {input('original_price', 'Giá gốc (đ)', { type: 'number', min: 1, placeholder: 'Để trống nếu không giảm' })}
            </div>
          )}
        </div>
      </div>
      {input('image_url', 'URL ảnh chính', { placeholder: 'https://… hoặc tải ảnh lên ở trên' })}
      <div>
        <label className="label">Mô tả</label>
        <textarea className="input" rows={3} value={f.description} onChange={(e) => set('description', e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {input('origin', 'Xuất xứ')}
        {input('roast_level', 'Mức rang')}
        {input('weight', 'Khối lượng / quy cách')}
      </div>
      <VariantEditor rows={f.variants} onChange={(rows) => set('variants', rows)} />
      <div>
        <label className="label">Ảnh phụ (mỗi dòng 1 URL)</label>
        <textarea className="input font-mono text-xs" rows={2} value={f.images} onChange={(e) => set('images', e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-3 text-sm font-medium"><Toggle checked={f.is_active} onChange={(v) => set('is_active', v)} /> Hiển thị trên cửa hàng</label>
        <label className="flex items-center gap-3 text-sm font-medium"><Toggle checked={f.is_featured} onChange={(v) => set('is_featured', v)} /> Sản phẩm nổi bật</label>
        <label className="flex items-center gap-3 text-sm font-medium"><Toggle checked={f.has_grind_option} onChange={(v) => set('has_grind_option', v)} /> Cho chọn kiểu xay</label>
        <label className="flex items-center gap-3 text-sm font-medium"><Toggle checked={f.is_drink} onChange={(v) => set('is_drink', v)} /> Đồ uống pha chế (chọn đá, đường)</label>
        <label className="flex items-center gap-3 text-sm font-medium"><Toggle checked={f.allow_toppings} onChange={(v) => set('allow_toppings', v)} /> Cho thêm topping</label>
      </div>
      <div className="flex justify-end gap-2 border-t border-coffee-100 pt-5">
        <button type="button" className="btn-outline" onClick={onCancel}>Hủy</button>
        <button className="btn-primary" disabled={saving || uploading}>{saving && <Spinner className="h-4 w-4" />} {productId ? 'Lưu thay đổi' : 'Thêm sản phẩm'}</button>
      </div>
    </form>
  )
}

export default function AdminProducts() {
  useDocumentTitle('Admin – Sản phẩm')
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<Page<Product> | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [q, setQ] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [stock, setStock] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<{ id: number | null; form: FormState } | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [busy, setBusy] = useState(false)
  const dq = useDebounce(q, 300)

  const load = () =>
    api.get<Page<Product>>('/api/admin/products', {
      params: { q: dq || undefined, category_id: categoryId || undefined, stock: stock || undefined, page, page_size: 10 },
    }).then((r) => setData(r.data))

  useEffect(() => { api.get<Category[]>('/api/categories').then((r) => setCategories(r.data)) }, [])
  useEffect(() => { setPage(1) }, [dq, categoryId, stock])
  useEffect(() => { load() }, [dq, categoryId, stock, page]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mở form sửa từ link ?edit=ID (VD từ dashboard "Sắp hết hàng")
  useEffect(() => {
    const id = params.get('edit')
    if (!id) return
    api.get<Product>(`/api/admin/products/${id}`).then((r) => setEditing({ id: r.data.id, form: toForm(r.data) }))
    setParams({}, { replace: true })
  }, [params, setParams])

  const patch = async (p: Product, body: Partial<Product>, msg: string) => {
    try {
      const { data: updated } = await api.patch<Product>(`/api/admin/products/${p.id}`, body)
      setData((d) => d && { ...d, items: d.items.map((x) => (x.id === p.id ? updated : x)) })
      toast.success(msg)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const promptStock = (p: Product) => {
    if (p.variants.length) return setEditing({ id: p.id, form: toForm(p) }) // tồn kho theo phân loại -> mở form
    const v = window.prompt(`Cập nhật tồn kho cho "${p.name}"`, String(p.stock))
    if (v === null) return
    const n = parseInt(v)
    if (isNaN(n) || n < 0) return toast.error('Số lượng không hợp lệ')
    patch(p, { stock: n }, 'Đã cập nhật tồn kho')
  }

  const remove = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await api.delete(`/api/admin/products/${deleting.id}`)
      toast.success('Đã xóa sản phẩm')
      setDeleting(null)
      load()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <AdminPageHeader kicker="Thực đơn" title="Sản phẩm" desc={data ? `${data.total} sản phẩm` : ''}
        action={<button className="btn-primary" onClick={() => setEditing({ id: null, form: EMPTY })}><Plus size={18} /> Thêm sản phẩm</button>} />

      <div className="card mb-4 flex flex-wrap gap-3 p-4">
        <div className="relative min-w-60 flex-1">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-coffee-300" />
          <input className="input pl-9" placeholder="Tìm theo tên, xuất xứ…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input w-auto" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input w-auto" value={stock} onChange={(e) => setStock(e.target.value)}>
          <option value="">Mọi tồn kho</option>
          <option value="in">Còn hàng</option>
          <option value="low">Sắp hết (≤5)</option>
          <option value="out">Hết hàng</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream-100/70 text-left text-xs uppercase tracking-wider text-coffee-500">
              <tr>
                <th className="px-4 py-3 font-medium">Sản phẩm</th>
                <th className="px-4 py-3 font-medium">Giá</th>
                <th className="px-4 py-3 font-medium">Tồn kho</th>
                <th className="px-4 py-3 font-medium">Đã bán</th>
                <th className="px-4 py-3 text-center font-medium">Hiển thị</th>
                <th className="px-4 py-3 text-center font-medium">Nổi bật</th>
                <th className="px-4 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-coffee-50">
              {data?.items.map((p) => (
                <tr key={p.id} className={`hover:bg-cream-50 ${!p.is_active ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={imageUrl(p.image_url)} alt="" className="h-11 w-11 rounded-lg object-cover" />
                      <div className="min-w-0">
                        <p className="max-w-64 truncate font-medium">{p.name}</p>
                        <p className="text-xs text-coffee-400">{p.category?.name ?? '—'} · #{p.id}{p.variants.length > 0 && ` · ${p.variants.length} phân loại`}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold">{formatVND(p.price)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => promptStock(p)} title="Bấm để sửa số lượng"
                        className={`chip cursor-pointer ${p.stock === 0 ? 'bg-rose-50 text-rose-700' : p.stock <= 5 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {p.stock === 0 ? 'Hết hàng' : `Còn ${p.stock}`}
                      </button>
                      {p.stock > 0 ? (
                        <button className="text-xs text-coffee-400 hover:text-rose-600" onClick={() => patch(p, { stock: 0 }, 'Đã đánh dấu hết hàng')}>Đặt hết</button>
                      ) : (
                        <button className="text-xs text-coffee-400 hover:text-emerald-600" onClick={() => promptStock(p)}>Nhập hàng</button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-coffee-500">{p.sold_count}</td>
                  <td className="px-4 py-3"><div className="flex justify-center"><Toggle label="Hiển thị" checked={p.is_active} onChange={(v) => patch(p, { is_active: v }, v ? 'Đã hiển thị' : 'Đã ẩn sản phẩm')} /></div></td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => patch(p, { is_featured: !p.is_featured }, 'Đã cập nhật')} aria-label="Nổi bật">
                      <Star size={18} className={p.is_featured ? 'text-caramel-500' : 'text-coffee-200'} fill={p.is_featured ? 'currentColor' : 'none'} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button className="rounded-lg p-2 text-coffee-500 hover:bg-coffee-50 hover:text-coffee-900" onClick={() => setEditing({ id: p.id, form: toForm(p) })} aria-label="Sửa"><Pencil size={16} /></button>
                      <button className="rounded-lg p-2 text-coffee-500 hover:bg-rose-50 hover:text-rose-600" onClick={() => setDeleting(p)} aria-label="Xóa"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.items.length === 0 && <EmptyState icon={<Search size={28} />} title="Không có sản phẩm phù hợp" />}
        {data && data.pages > 1 && <div className="border-t border-coffee-50 p-4"><Pagination page={data.page} pages={data.pages} onChange={setPage} /></div>}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'} wide>
        {editing && (
          <ProductForm key={editing.id ?? 'new'} initial={editing.form} productId={editing.id} categories={categories}
            onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
        )}
      </Modal>

      <ConfirmDialog open={!!deleting} title="Xóa sản phẩm?" danger loading={busy} confirmText="Xóa"
        message={<>Xóa vĩnh viễn <b>{deleting?.name}</b>? Các đơn hàng cũ vẫn giữ thông tin sản phẩm. Nếu chỉ muốn tạm ngưng bán, hãy tắt “Hiển thị”.</>}
        onConfirm={remove} onClose={() => setDeleting(null)} />
    </>
  )
}
