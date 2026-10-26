import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ShoppingBag, Trash2, Truck } from 'lucide-react'
import { api, imageUrl } from '../api/client'
import type { Product } from '../api/types'
import { EmptyState, QuantityInput } from '../components/ui'
import PageHero, { HeroStat } from '../components/PageHero'
import { useAuth } from '../store/auth'
import { cartCount, cartSubtotal, lineLabel, lineStock, unitPrice, useCart } from '../store/cart'
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE, formatVND } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'

export function FreeShipProgress({ amount, dark }: { amount: number; dark?: boolean }) {
  const remain = FREE_SHIPPING_THRESHOLD - amount
  const pct = Math.min(100, (amount / FREE_SHIPPING_THRESHOLD) * 100)
  return (
    <div className={`rounded-2xl p-4 ${dark ? 'bg-white/5' : 'bg-cream-100'}`}>
      <p className="flex items-start gap-2 text-sm">
        <Truck size={16} className={`mt-0.5 shrink-0 ${dark ? 'text-caramel-400' : 'text-caramel-600'}`} />
        <span>{remain > 0 ? <>Mua thêm <b>{formatVND(remain)}</b> để được miễn phí giao hàng</> : <b className={dark ? 'text-emerald-300' : 'text-emerald-700'}>Bạn được miễn phí giao hàng! 🎉</b>}</span>
      </p>
      <div className={`mt-3 h-1 overflow-hidden rounded-full ${dark ? 'bg-white/10' : 'bg-coffee-100'}`}>
        <div className="h-full rounded-full bg-gradient-to-r from-caramel-400 to-caramel-600 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function Cart() {
  useDocumentTitle('Giỏ hàng')
  const { items, setQuantity, remove, syncProducts, clear } = useCart()
  const user = useAuth((s) => s.user)
  const navigate = useNavigate()
  const subtotal = cartSubtotal(items)
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_FEE

  // Cập nhật giá & tồn kho mới nhất khi mở giỏ
  useEffect(() => {
    if (!items.length) return
    const ids = [...new Set(items.map((i) => i.product.id))]
    Promise.allSettled(ids.map((id) => api.get<Product>(`/api/products/${id}`))).then((results) => {
      const fresh = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value.data] : []))
      syncProducts(fresh)
      // Sản phẩm đã ngừng bán -> bỏ khỏi giỏ
      const gone = ids.filter((_, idx) => results[idx].status === 'rejected')
      items.filter((i) => gone.includes(i.product.id)).forEach((i) => remove(i.key))
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const hero = (
    <PageHero kicker="Giỏ hàng" title={['Giỏ hàng', <em key="e">{items.length ? 'của bạn.' : 'đang trống.'}</em>]}
      aside={items.length ? <HeroStat value={cartCount(items)} label="món đã chọn" /> : undefined}
      crumbs={[{ label: 'Cửa hàng', to: '/shop' }, { label: 'Giỏ hàng' }]} />
  )

  if (!items.length) {
    return (
      <div>
        {hero}
        <div className="container-page py-10">
          <EmptyState icon={<ShoppingBag size={30} />} title="Chưa có món nào" desc="Hãy chọn vài gói cà phê thơm ngon nhé!"
            action={<Link to="/shop" className="btn-primary">Tiếp tục mua sắm</Link>} />
        </div>
      </div>
    )
  }

  const outOfStock = items.some((i) => lineStock(i) === 0)

  return (
    <div>
      {hero}
      <div className="container-page grid gap-12 pt-12 lg:grid-cols-12">
        <div className="lg:col-span-7 xl:col-span-8">
          <div className="flex items-center justify-between border-b border-coffee-100 pb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-coffee-400">
            <span>Sản phẩm</span>
            <button className="link-underline uppercase tracking-[0.22em] hover:text-rose-600" onClick={clear}>Xóa tất cả</button>
          </div>
          <div className="divide-y divide-coffee-100">
            {items.map((item, idx) => {
              const { product: p, quantity, key } = item
              const stock = lineStock(item), price = unitPrice(item), label = lineLabel(item)
              return (
                <div key={key} className="flex gap-5 py-6 animate-slide-up" style={{ animationDelay: `${idx * 60}ms` }}>
                  <Link to={`/products/${p.slug}`} className="group shrink-0 overflow-hidden rounded-2xl">
                    <img src={imageUrl(p.image_url)} alt={p.name} className="h-28 w-24 object-cover transition duration-700 group-hover:scale-110 sm:h-32 sm:w-28" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <Link to={`/products/${p.slug}`} className="block font-display text-xl font-semibold leading-snug hover:text-caramel-600">{p.name}</Link>
                        {label && <p className="mt-1 text-sm text-coffee-500">{label}</p>}
                      </div>
                      <button onClick={() => remove(key)} className="h-fit rounded-full p-2 text-coffee-300 transition hover:bg-rose-50 hover:text-rose-600" aria-label="Xóa">
                        <Trash2 size={17} />
                      </button>
                    </div>
                    {stock === 0 && <p className="mt-1 text-sm font-medium text-rose-600">Đã hết hàng – vui lòng xóa khỏi giỏ</p>}
                    {stock > 0 && quantity >= stock && <p className="mt-1 text-xs text-amber-600">Đã đạt số lượng tối đa trong kho</p>}
                    <div className="mt-auto flex items-end justify-between pt-3">
                      <QuantityInput size="sm" value={quantity} max={Math.max(stock, 1)} onChange={(v) => setQuantity(key, v)} />
                      <div className="text-right">
                        {quantity > 1 && <p className="text-xs text-coffee-400">{formatVND(price)} / món</p>}
                        <p className="font-display text-xl font-semibold">{formatVND(price * quantity)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <Link to="/shop" className="link-underline mt-4 inline-block text-sm font-medium text-coffee-600 hover:text-coffee-900">← Tiếp tục mua sắm</Link>
        </div>

        {/* Hóa đơn tóm tắt: khối tối đồng bộ với trang chủ */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="sticky top-24 space-y-5 rounded-[2rem] bg-espresso-900 p-7 text-latte-100">
            <h2 className="font-display text-2xl font-semibold text-latte-50">Tóm tắt đơn hàng</h2>
            <FreeShipProgress amount={subtotal} dark />
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-latte-300">Tạm tính</dt><dd>{formatVND(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-latte-300">Phí giao hàng</dt><dd>{shipping ? formatVND(shipping) : 'Miễn phí'}</dd></div>
              <div className="flex items-baseline justify-between border-t border-dashed border-white/15 pt-4">
                <dt className="font-semibold text-latte-50">Tổng cộng</dt>
                <dd className="font-display text-3xl font-semibold text-latte-50">{formatVND(subtotal + shipping)}</dd>
              </div>
            </dl>
            <p className="text-xs text-latte-400">Mã giảm giá có thể áp dụng ở bước thanh toán.</p>
            <button className="btn shine w-full bg-latte-50 py-3.5 text-base text-espresso-900 hover:bg-caramel-400" disabled={outOfStock}
              onClick={() => navigate(user ? '/checkout' : '/login?redirect=/checkout')}>
              Tiến hành thanh toán <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
