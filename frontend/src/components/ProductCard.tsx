import { Link } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Product } from '../api/types'
import { imageUrl } from '../api/client'
import { useCart } from '../store/cart'
import { discountPercent, formatVND } from '../lib/format'
import { Skeleton, Stars } from './ui'

export function addToCartWithToast(add: ReturnType<typeof useCart.getState>['add'], product: Product, qty = 1) {
  add(product, qty)
  toast.success(
    <span>Đã thêm <b>{product.name}</b> vào giỏ</span>,
    { id: `cart-${product.id}` },
  )
}

export default function ProductCard({ product }: { product: Product }) {
  const add = useCart((s) => s.add)
  const off = discountPercent(product.price, product.original_price)

  return (
    <div className="group card relative flex flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-coffee-900/5">
      <Link to={`/products/${product.slug}`} className="relative block aspect-square overflow-hidden bg-cream-100">
        <img
          src={imageUrl(product.image_url)}
          alt={product.name}
          loading="lazy"
          className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${!product.in_stock ? 'opacity-60 grayscale' : ''}`}
        />
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {off > 0 && <span className="chip bg-rose-500 text-white">-{off}%</span>}
          {product.is_featured && <span className="chip bg-coffee-800/90 text-cream-50">Nổi bật</span>}
        </div>
        {!product.in_stock && (
          <span className="absolute inset-x-0 bottom-0 bg-coffee-900/75 py-1.5 text-center text-xs font-semibold uppercase tracking-wider text-white">
            Hết hàng
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-caramel-600">{product.category?.name}</p>
        <Link to={`/products/${product.slug}`} className="mt-1 line-clamp-2 font-semibold leading-snug text-coffee-900 hover:text-caramel-600">
          {product.name}
        </Link>
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-coffee-400">
          <Stars value={product.rating_avg} size={12} />
          <span>({product.rating_count})</span>
          <span className="text-coffee-200">•</span>
          <span>Đã bán {product.sold_count}</span>
        </div>
        <div className="mt-auto flex items-end justify-between pt-3">
          <div>
            <p className="text-lg font-bold text-coffee-900">{formatVND(product.price)}</p>
            {off > 0 && <p className="text-xs text-coffee-300 line-through">{formatVND(product.original_price!)}</p>}
          </div>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-coffee-800 text-white transition hover:bg-caramel-500 disabled:cursor-not-allowed disabled:bg-coffee-200"
            disabled={!product.in_stock}
            onClick={() => addToCartWithToast(add, product)}
            aria-label="Thêm vào giỏ"
            title={product.in_stock ? 'Thêm vào giỏ' : 'Hết hàng'}
          >
            <ShoppingBag size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <Skeleton className="aspect-square rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-6 w-1/3" />
      </div>
    </div>
  )
}
