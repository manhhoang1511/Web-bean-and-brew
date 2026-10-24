import { Link } from 'react-router-dom'
import { Heart, ShoppingBag, SlidersHorizontal } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Product, Variant } from '../api/types'
import { imageUrl } from '../api/client'
import { type LineOptions, optionsLabel, useCart } from '../store/cart'
import { DEFAULT_META } from '../lib/meta'
import { flyToCart } from '../lib/animations'
import { useWishlist } from '../store/wishlist'
import { discountPercent, formatVND } from '../lib/format'
import { Skeleton, Stars } from './ui'
import Reveal from './Reveal'

/** Biến thể mặc định khi thêm nhanh từ thẻ sản phẩm: biến thể còn hàng đầu tiên */
export const defaultVariant = (p: Product): Variant | null =>
  p.variants.find((v) => v.stock > 0) ?? p.variants[0] ?? null

/** Tùy chọn mặc định khi bấm thêm nhanh (không qua trang chi tiết) */
export const defaultOptions = (p: Product): LineOptions => ({
  variant: defaultVariant(p),
  grind: p.has_grind_option ? 'Nguyên hạt' : null,
  sugar: p.is_drink ? DEFAULT_META.default_sugar : null,
  ice: p.is_drink ? DEFAULT_META.default_ice : null,
  toppings: [],
})

export function addToCartWithToast(
  add: ReturnType<typeof useCart.getState>['add'], product: Product, qty = 1, options: LineOptions = defaultOptions(product),
  sourceEl?: HTMLElement | null,
) {
  add(product, qty, options)
  flyToCart(sourceEl, product.image_url)
  const label = optionsLabel(options)
  toast.success(
    <span>Đã thêm <b>{product.name}</b>{label && ` (${label})`} vào giỏ</span>,
    { id: `cart-${product.id}` },
  )
}

export function HeartButton({ product, className = '' }: { product: Product; className?: string }) {
  const liked = useWishlist((s) => s.ids.includes(product.id))
  const toggle = useWishlist((s) => s.toggle)
  return (
    <button
      onClick={(e) => { e.preventDefault(); toggle(product.id, product.name) }}
      className={`flex items-center justify-center rounded-full transition hover:scale-110 ${className}`}
      aria-label={liked ? 'Bỏ yêu thích' : 'Yêu thích'}
      aria-pressed={liked}
      title={liked ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
    >
      {/* key đổi khi bấm -> chạy lại hiệu ứng "nảy" */}
      <Heart key={String(liked)} size={18} className={`${liked ? 'text-rose-500 animate-pop' : 'text-coffee-500'}`} fill={liked ? 'currentColor' : 'none'} />
    </button>
  )
}

export default function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const add = useCart((s) => s.add)
  const off = discountPercent(product.price, product.original_price)

  return (
    <Reveal delay={(index % 4) * 90} className="h-full">
    <div className="group card relative flex h-full flex-col overflow-hidden transition duration-500 ease-out hover:-translate-y-2 hover:shadow-2xl hover:shadow-coffee-900/10">
      <Link to={`/products/${product.slug}`} className="relative block aspect-square overflow-hidden bg-cream-100">
        <img
          src={imageUrl(product.image_url)}
          alt={product.name}
          loading="lazy"
          className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${!product.in_stock ? 'opacity-60 grayscale' : ''}`}
        />
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {off > 0 && <span className="chip bg-rose-500 text-white">-{off}%</span>}
          {product.is_featured && <span className="chip bg-espresso-800/90 text-latte-50">Nổi bật</span>}
          {product.is_drink && <span className="chip bg-surface/90 text-coffee-800 backdrop-blur">🧊 Tùy chỉnh đá · đường</span>}
        </div>
        {!product.in_stock && (
          <span className="absolute inset-x-0 bottom-0 bg-espresso-900/75 py-1.5 text-center text-xs font-semibold uppercase tracking-wider text-white">
            Hết hàng
          </span>
        )}
      </Link>
      <HeartButton product={product} className="absolute right-3 top-3 h-9 w-9 bg-surface/90 shadow-sm backdrop-blur" />

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
            <p className="text-lg font-bold text-coffee-900">
              {product.variants.length > 1 && <span className="mr-1 text-xs font-medium text-coffee-400">từ</span>}
              {formatVND(product.price)}
            </p>
            {off > 0 && <p className="text-xs text-coffee-300 line-through">{formatVND(product.original_price!)}</p>}
          </div>
          {product.is_drink ? (
            // Đồ uống: vào trang chi tiết để chọn size / đá / đường / topping
            <Link to={`/products/${product.slug}`} title="Chọn size, đá, đường, topping"
              className="flex h-10 items-center gap-1 rounded-xl bg-caramel-500 px-3 text-xs font-semibold text-white transition hover:scale-105 hover:bg-caramel-600">
              <SlidersHorizontal size={15} /> Chọn
            </Link>
          ) : (
            <button
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-coffee-800 text-cream-50 transition hover:scale-110 hover:bg-caramel-500 active:scale-95 disabled:cursor-not-allowed disabled:bg-coffee-200 disabled:hover:scale-100"
              disabled={!product.in_stock}
              onClick={(e) => addToCartWithToast(add, product, 1, undefined, e.currentTarget.closest('.group')?.querySelector('img'))}
              aria-label="Thêm vào giỏ"
              title={product.in_stock ? 'Thêm vào giỏ' : 'Hết hàng'}
            >
              <ShoppingBag size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
    </Reveal>
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
