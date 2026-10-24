import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ShoppingBag, Trash2, Truck } from 'lucide-react'
import { api, imageUrl } from '../api/client'
import type { Product } from '../api/types'
import { EmptyState, QuantityInput } from '../components/ui'
import { useAuth } from '../store/auth'
import { cartCount, cartSubtotal, lineLabel, lineStock, unitPrice, useCart } from '../store/cart'
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE, formatVND } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'

export function FreeShipProgress({ amount }: { amount: number }) {
  const remain = FREE_SHIPPING_THRESHOLD - amount
  const pct = Math.min(100, (amount / FREE_SHIPPING_THRESHOLD) * 100)
  return (
    <div className="rounded-xl bg-cream-100 p-3">
      <p className="flex items-start gap-2 text-sm">
        <Truck size={16} className="mt-0.5 shrink-0 text-caramel-600" />
        <span>{remain > 0 ? <>Mua thêm <b>{formatVND(remain)}</b> để được miễn phí giao hàng</> : <b className="text-emerald-700">Bạn được miễn phí giao hàng! 🎉</b>}</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-coffee-100">
        <div className="h-full rounded-full bg-caramel-500 transition-all duration-500" style={{ width: `${pct}%` }} />
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

  if (!items.length) {
    return (
      <div className="container-page py-10">
        <EmptyState icon={<ShoppingBag size={30} />} title="Giỏ hàng trống" desc="Hãy chọn vài gói cà phê thơm ngon nhé!"
          action={<Link to="/shop" className="btn-primary">Tiếp tục mua sắm</Link>} />
      </div>
    )
  }

  const outOfStock = items.some((i) => lineStock(i) === 0)

  return (
    <div className="container-page py-10">
      <div className="mb-8 flex items-end justify-between">
        <h1 className="font-display text-3xl font-bold">Giỏ hàng <span className="text-coffee-300">({cartCount(items)})</span></h1>
        <button className="text-sm text-coffee-400 hover:text-rose-600" onClick={clear}>Xóa tất cả</button>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {items.map((item) => {
            const { product: p, quantity, key } = item
            const stock = lineStock(item), price = unitPrice(item), label = lineLabel(item)
            return (
              <div key={key} className="card flex gap-4 p-4">
                <Link to={`/products/${p.slug}`} className="shrink-0">
                  <img src={imageUrl(p.image_url)} alt={p.name} className="h-24 w-24 rounded-xl object-cover" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex justify-between gap-3">
                    <div>
                      <Link to={`/products/${p.slug}`} className="font-semibold hover:text-caramel-600">{p.name}</Link>
                      {label && <p className="mt-0.5"><span className="chip bg-cream-100 text-coffee-600">{label}</span></p>}
                    </div>
                    <button onClick={() => remove(key)} className="h-fit rounded-lg p-1.5 text-coffee-300 hover:bg-rose-50 hover:text-rose-600" aria-label="Xóa">
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-coffee-400">{formatVND(price)}</p>
                  {stock === 0 && <p className="text-sm font-medium text-rose-600">Đã hết hàng – vui lòng xóa khỏi giỏ</p>}
                  {stock > 0 && quantity >= stock && <p className="text-xs text-amber-600">Đã đạt số lượng tối đa trong kho</p>}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <QuantityInput size="sm" value={quantity} max={Math.max(stock, 1)} onChange={(v) => setQuantity(key, v)} />
                    <p className="font-bold">{formatVND(price * quantity)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div>
          <div className="card sticky top-24 space-y-4 p-6">
            <h2 className="text-lg font-semibold">Tóm tắt đơn hàng</h2>
            <FreeShipProgress amount={subtotal} />
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-coffee-500">Tạm tính</dt><dd className="font-medium">{formatVND(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-coffee-500">Phí giao hàng</dt><dd className="font-medium">{shipping ? formatVND(shipping) : 'Miễn phí'}</dd></div>
              <div className="flex justify-between border-t border-coffee-100 pt-3 text-base"><dt className="font-semibold">Tổng cộng</dt><dd className="text-xl font-bold">{formatVND(subtotal + shipping)}</dd></div>
            </dl>
            <p className="text-xs text-coffee-400">Mã giảm giá có thể áp dụng ở bước thanh toán.</p>
            <button className="btn-accent w-full py-3 text-base" disabled={outOfStock}
              onClick={() => navigate(user ? '/checkout' : '/login?redirect=/checkout')}>
              Tiến hành thanh toán <ArrowRight size={18} />
            </button>
            <Link to="/shop" className="block text-center text-sm font-medium text-coffee-500 hover:text-coffee-800">← Tiếp tục mua sắm</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
