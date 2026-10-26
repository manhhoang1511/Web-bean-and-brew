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
import PageHero from '../components/PageHero'

const METHODS: { id: PaymentMethod; label: string; desc: string; icon: typeof Banknote }[] = [
  { id: 'cod', label: 'Thanh toán khi nhận hàng', desc: 'Trả tiền mặt cho shipper', icon: Banknote },
  { id: 'card', label: 'Thẻ tín dụng / ghi nợ', desc: 'Visa, Mastercard (giả lập)', icon: CreditCard },
  { id: 'qr', label: 'Chuyển khoản QR', desc: 'Quét mã bằng app ngân hàng (giả lập)', icon: QrCode },
]

/** Các bước mua hàng hiển thị trong đầu trang */
function Steps({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold uppercase tracking-[0.2em]">
      {['Giỏ hàng', 'Thanh toán', 'Hoàn tất'].map((label, i) => (
        <li key={label} className={`flex items-center gap-3 ${i <= current ? 'text-latte-50' : 'text-latte-400'}`}>
          <span className={`flex h-8 w-8 items-center justify-center rounded-full border font-display text-sm normal-case tracking-normal ${i < current ? 'border-caramel-400 bg-caramel-400 text-espresso-900' : i === current ? 'border-latte-50' : 'border-white/20'}`}>
            {String(i + 1).padStart(2, '0')}
          </span>
          {label}
          {i < 2 && <span className="h-px w-8 bg-white/20" />}
        </li>
      ))}
    </ol>
  )
}

/** Tiêu đề mục đánh số lớn kiểu tạp chí */
function SectionTitle({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <h2 className="flex items-baseline gap-4 border-b border-coffee-100 pb-4">
      <span className="font-display text-4xl font-semibold text-caramel-500">{n}</span>
      <span className="font-display text-2xl font-semibold">{children}</span>
    </h2>
  )
}

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
    <div>
      <PageHero kicker="Thanh toán an toàn" title={['Gần xong', <em key="e">rồi đấy.</em>]}
        subtitle="Điền thông tin giao hàng, chọn cách thanh toán – tách cà phê sẽ sớm đến tay bạn."
        crumbs={[{ label: 'Giỏ hàng', to: '/cart' }, { label: 'Thanh toán' }]}>
        <Steps current={1} />
      </PageHero>
      <form onSubmit={placeOrder} className="container-page grid gap-12 pt-12 lg:grid-cols-12">
        <div className="space-y-12 lg:col-span-7">
          <section className="space-y-5">
            <SectionTitle n="01">Thông tin giao hàng</SectionTitle>
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

          <section className="space-y-5">
            <SectionTitle n="02">Phương thức thanh toán</SectionTitle>
            <div className="space-y-3">
              {METHODS.map(({ id, label, desc, icon: Icon }) => (
                <label key={id} className={`flex cursor-pointer items-center gap-4 rounded-2xl border p-5 transition ${method === id ? 'border-coffee-900 bg-surface shadow-lg shadow-coffee-900/5' : 'border-coffee-100 hover:border-coffee-300'}`}>
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

        <div className="lg:col-span-5">
          <div className="sticky top-24 rounded-[2rem] bg-espresso-900 p-7 text-latte-100">
            <h2 className="mb-5 font-display text-2xl font-semibold text-latte-50">Đơn hàng <span className="text-latte-400">({items.length})</span></h2>
            <div className="scrollbar-thin max-h-64 space-y-3 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.key} className="flex items-center gap-3">
                  <div className="relative">
                    <img src={imageUrl(item.product.image_url)} alt="" className="h-16 w-14 rounded-xl object-cover" />
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-caramel-500 px-1 text-[11px] font-bold text-white">{item.quantity}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm">{item.product.name}</p>
                    {lineLabel(item) && <p className="text-xs text-latte-400">{lineLabel(item)}</p>}
                  </div>
                  <p className="text-sm font-semibold">{formatVND(unitPrice(item) * item.quantity)}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-white/10 pt-5">
              {coupon ? (
                <div className="flex items-center justify-between rounded-2xl border border-dashed border-emerald-400/60 bg-emerald-400/10 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Tag size={16} className="text-emerald-300" />
                    <div><p className="font-semibold text-emerald-300">{coupon.code}</p><p className="text-xs text-emerald-200/80">{coupon.description}</p></div>
                  </div>
                  <button type="button" onClick={() => setCoupon(null)} className="text-emerald-300 hover:text-rose-400" aria-label="Bỏ mã"><X size={16} /></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input className="input rounded-full border-white/15 bg-white/5 uppercase text-latte-50 placeholder:text-latte-400" placeholder="Mã giảm giá (VD: WELCOME10)" value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyCoupon())} />
                  <button type="button" className="btn shrink-0 border border-white/20 text-latte-50 hover:bg-white/10" onClick={applyCoupon} disabled={checking}>{checking ? <Spinner className="h-4 w-4" /> : 'Áp dụng'}</button>
                </div>
              )}
            </div>

            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-latte-300">Tạm tính</dt><dd>{formatVND(subtotal)}</dd></div>
              {discount > 0 && <div className="flex justify-between text-emerald-300"><dt>Giảm giá</dt><dd>-{formatVND(discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-latte-300">Phí giao hàng</dt><dd>{shipping ? formatVND(shipping) : 'Miễn phí'}</dd></div>
              <div className="flex items-baseline justify-between border-t border-dashed border-white/15 pt-4"><dt className="font-semibold text-latte-50">Tổng thanh toán</dt><dd className="font-display text-3xl font-semibold text-latte-50">{formatVND(total)}</dd></div>
            </dl>

            <button className="btn shine mt-6 w-full bg-latte-50 py-3.5 text-base text-espresso-900 hover:bg-caramel-400" disabled={placing}>
              {placing ? <Spinner className="h-5 w-5" /> : <Lock size={17} />} Đặt hàng
            </button>
            <p className="mt-3 text-center text-xs text-latte-400">
              Bằng việc đặt hàng, bạn đồng ý với <Link to="/" className="underline">điều khoản</Link> của Bean & Brew.
            </p>
          </div>
        </div>
      </form>
    </div>
  )
}
