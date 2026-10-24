import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Banknote, CreditCard, Lock, QrCode, Tag, X } from 'lucide-react'
import { api, errorMessage, imageUrl } from '../api/client'
import type { Order, PaymentMethod } from '../api/types'
import { Spinner } from '../components/ui'
import { useAuth } from '../store/auth'
import { cartSubtotal, lineLabel, toOrderLine, unitPrice, useCart } from '../store/cart'
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE, formatVND } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'

const METHODS: { id: PaymentMethod; label: string; desc: string; icon: typeof Banknote }[] = [
  { id: 'cod', label: 'Thanh toán khi nhận hàng', desc: 'Trả tiền mặt cho shipper', icon: Banknote },
  { id: 'card', label: 'Thẻ tín dụng / ghi nợ', desc: 'Visa, Mastercard (giả lập)', icon: CreditCard },
  { id: 'qr', label: 'Chuyển khoản QR', desc: 'Quét mã bằng app ngân hàng (giả lập)', icon: QrCode },
]

const formatCard = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ')

export default function Checkout() {
  useDocumentTitle('Thanh toán')
  const user = useAuth((s) => s.user)
  const { items, clear } = useCart()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    shipping_name: user?.full_name ?? '',
    shipping_phone: user?.phone ?? '',
    shipping_address: user?.address ?? '',
    note: '',
  })
  const [method, setMethod] = useState<PaymentMethod>('cod')
  const [card, setCard] = useState({ number: '', name: '', exp: '', cvc: '' })
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState<{ code: string; description: string; discount: number } | null>(null)
  const [checking, setChecking] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!items.length && !placing) return <Navigate to="/cart" replace />

  const subtotal = cartSubtotal(items)
  const discount = coupon?.discount ?? 0
  const shipping = subtotal - discount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
  const total = subtotal - discount + shipping

  const applyCoupon = async () => {
    if (!couponInput.trim()) return
    setChecking(true)
    try {
      const { data } = await api.post('/api/coupons/check', { code: couponInput, subtotal })
      setCoupon(data)
      toast.success(`Áp dụng mã ${data.code}: -${formatVND(data.discount)}`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setChecking(false)
    }
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (form.shipping_name.trim().length < 2) e.shipping_name = 'Vui lòng nhập họ tên'
    if (!/^0\d{9,10}$/.test(form.shipping_phone)) e.shipping_phone = 'Số điện thoại không hợp lệ (VD: 0901234567)'
    if (form.shipping_address.trim().length < 5) e.shipping_address = 'Vui lòng nhập địa chỉ đầy đủ'
    if (method === 'card') {
      if (card.number.replace(/\s/g, '').length < 16) e.card_number = 'Số thẻ gồm 16 chữ số'
      if (!/^\d{2}\/\d{2}$/.test(card.exp)) e.card_exp = 'MM/YY'
      if (!/^\d{3}$/.test(card.cvc)) e.card_cvc = '3 số'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return toast.error('Vui lòng kiểm tra lại thông tin')
    setPlacing(true)
    try {
      const { data } = await api.post<Order>('/api/orders', {
        ...form,
        payment_method: method,
        coupon_code: coupon?.code,
        card_number: method === 'card' ? card.number : undefined,
        items: items.map(toOrderLine),
      })
      clear()
      navigate(`/orders/${data.code}?success=1`, { replace: true })
    } catch (err) {
      toast.error(errorMessage(err, 'Đặt hàng thất bại'))
      setPlacing(false)
    }
  }

  const field = (name: keyof typeof form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} className={`input ${errors[name] ? 'border-rose-400' : ''}`} value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })} {...props} />
      {errors[name] && <p className="mt-1 text-xs text-rose-600">{errors[name]}</p>}
    </div>
  )

  return (
    <div className="container-page py-10">
      <h1 className="mb-8 font-display text-3xl font-bold">Thanh toán</h1>
      <form onSubmit={placeOrder} className="grid gap-8 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <section className="card space-y-4 p-6">
            <h2 className="text-lg font-semibold">1. Thông tin giao hàng</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {field('shipping_name', 'Họ và tên')}
              {field('shipping_phone', 'Số điện thoại', { inputMode: 'tel', placeholder: '0901234567' })}
            </div>
            {field('shipping_address', 'Địa chỉ nhận hàng', { placeholder: 'Số nhà, đường, phường, quận, tỉnh/thành' })}
            <div>
              <label className="label" htmlFor="note">Ghi chú (tùy chọn)</label>
              <textarea id="note" className="input" rows={2} placeholder="VD: Giao giờ hành chính" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
          </section>

          <section className="card space-y-4 p-6">
            <h2 className="text-lg font-semibold">2. Phương thức thanh toán</h2>
            <div className="space-y-3">
              {METHODS.map(({ id, label, desc, icon: Icon }) => (
                <label key={id} className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 p-4 transition ${method === id ? 'border-caramel-500 bg-caramel-500/5' : 'border-coffee-100 hover:border-coffee-200'}`}>
                  <input type="radio" name="method" className="h-4 w-4 accent-caramel-500" checked={method === id} onChange={() => setMethod(id)} />
                  <Icon size={22} className="text-coffee-600" />
                  <div>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-xs text-coffee-400">{desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {method === 'card' && (
              <div className="space-y-3 rounded-xl bg-cream-100 p-4 animate-fade-in">
                <div>
                  <label className="label">Số thẻ</label>
                  <input className={`input font-mono ${errors.card_number ? 'border-rose-400' : ''}`} placeholder="4242 4242 4242 4242" inputMode="numeric"
                    value={card.number} onChange={(e) => setCard({ ...card, number: formatCard(e.target.value) })} />
                  {errors.card_number && <p className="mt-1 text-xs text-rose-600">{errors.card_number}</p>}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-3 sm:col-span-1">
                    <label className="label">Tên chủ thẻ</label>
                    <input className="input uppercase" placeholder="NGUYEN VAN A" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Hết hạn</label>
                    <input className={`input ${errors.card_exp ? 'border-rose-400' : ''}`} placeholder="MM/YY" value={card.exp}
                      onChange={(e) => setCard({ ...card, exp: e.target.value.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(?=\d)/, '$1/') })} />
                  </div>
                  <div>
                    <label className="label">CVC</label>
                    <input className={`input ${errors.card_cvc ? 'border-rose-400' : ''}`} placeholder="123" inputMode="numeric" value={card.cvc}
                      onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
                  </div>
                </div>
                <p className="text-xs text-coffee-500">
                  💡 Thẻ test: <code className="font-mono">4242 4242 4242 4242</code> (thành công) · <code className="font-mono">4000 0000 0000 0002</code> (bị từ chối)
                </p>
              </div>
            )}

            {method === 'qr' && (
              <p className="rounded-xl bg-cream-100 p-4 text-sm text-coffee-600 animate-fade-in">
                📱 Sau khi đặt hàng, mã QR kèm nội dung chuyển khoản sẽ hiển thị. Đơn được giao khi hệ thống xác nhận đã nhận tiền.
              </p>
            )}
          </section>
        </div>

        <div className="lg:col-span-2">
          <div className="card sticky top-24 p-6">
            <h2 className="mb-4 text-lg font-semibold">Đơn hàng ({items.length} sản phẩm)</h2>
            <div className="scrollbar-thin max-h-64 space-y-3 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.key} className="flex items-center gap-3">
                  <div className="relative">
                    <img src={imageUrl(item.product.image_url)} alt="" className="h-14 w-14 rounded-lg object-cover" />
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-coffee-700 px-1 text-[11px] font-bold text-cream-50">{item.quantity}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm">{item.product.name}</p>
                    {lineLabel(item) && <p className="text-xs text-coffee-400">{lineLabel(item)}</p>}
                  </div>
                  <p className="text-sm font-semibold">{formatVND(unitPrice(item) * item.quantity)}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-coffee-100 pt-5">
              {coupon ? (
                <div className="flex items-center justify-between rounded-xl border border-dashed border-emerald-400 bg-emerald-50 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-sm">
                    <Tag size={16} className="text-emerald-600" />
                    <div><p className="font-semibold text-emerald-700">{coupon.code}</p><p className="text-xs text-emerald-600">{coupon.description}</p></div>
                  </div>
                  <button type="button" onClick={() => setCoupon(null)} className="text-emerald-700 hover:text-rose-600" aria-label="Bỏ mã"><X size={16} /></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input className="input uppercase" placeholder="Mã giảm giá (VD: WELCOME10)" value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyCoupon())} />
                  <button type="button" className="btn-outline shrink-0" onClick={applyCoupon} disabled={checking}>{checking ? <Spinner className="h-4 w-4" /> : 'Áp dụng'}</button>
                </div>
              )}
            </div>

            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-coffee-500">Tạm tính</dt><dd>{formatVND(subtotal)}</dd></div>
              {discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Giảm giá</dt><dd>-{formatVND(discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-coffee-500">Phí giao hàng</dt><dd>{shipping ? formatVND(shipping) : 'Miễn phí'}</dd></div>
              <div className="flex items-center justify-between border-t border-coffee-100 pt-3"><dt className="font-semibold">Tổng thanh toán</dt><dd className="text-2xl font-bold text-coffee-900">{formatVND(total)}</dd></div>
            </dl>

            <button className="btn-accent mt-6 w-full py-3.5 text-base" disabled={placing}>
              {placing ? <Spinner className="h-5 w-5" /> : <Lock size={17} />} Đặt hàng
            </button>
            <p className="mt-3 text-center text-xs text-coffee-400">
              Bằng việc đặt hàng, bạn đồng ý với <Link to="/" className="underline">điều khoản</Link> của Bean & Brew.
            </p>
          </div>
        </div>
      </form>
    </div>
  )
}
