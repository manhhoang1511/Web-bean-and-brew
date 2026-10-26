import { Link } from 'react-router-dom'
import { Heart, ShoppingBag, SlidersHorizontal, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Product, Variant } from '../api/types'
import { imageUrl } from '../api/client'
import { type LineOptions, optionsLabel, useCart } from '../store/cart'
import { DEFAULT_META } from '../lib/meta'
import { flyToCart } from '../lib/animations'
import { useWishlist } from '../store/wishlist'
import { discountPercent, formatVND } from '../lib/format'
import { Skeleton } from './ui'
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

/**
 * Thẻ sản phẩm kiểu tạp chí: ảnh dọc 4:5 lớn, chữ serif, không viền hộp.
 * Nút thêm giỏ trượt lên từ đáy ảnh khi rê chuột (thiết bị cảm ứng: luôn hiện).
 */
export default function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const add = useCart((s) => s.add)
  const off = discountPercent(product.price, product.original_price)
  const action = 'flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold shadow-lg backdrop-blur-md transition'

  return (
    <Reveal delay={(index % 4) * 90} className="h-full">
      <div className="group relative flex h-full flex-col">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[1.4rem] bg-cream-100">
          <Link to={`/products/${product.slug}`} className="block h-full" tabIndex={-1}>
            <img
              src={imageUrl(product.image_url)}
              alt={product.name}
              loading="lazy"
              className={`h-full w-full object-cover transition duration-[1.2s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.07] ${!product.in_stock ? 'opacity-60 grayscale' : ''}`}
            />
          </Link>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-espresso-900/50 via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
          <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {off > 0 && <span className="chip bg-caramel-500 py-1 font-semibold text-white">-{off}%</span>}
            {product.is_featured && <span className="chip bg-espresso-900/75 py-1 text-latte-50 backdrop-blur">Nổi bật</span>}
            {product.is_drink && <span className="chip bg-surface/85 py-1 text-coffee-800 backdrop-blur">Tùy chỉnh đá · đường</span>}
          </div>
          <HeartButton product={product} className="absolute right-3 top-3 h-10 w-10 bg-surface/85 shadow-sm backdrop-blur" />
          {!product.in_stock && (
            <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-display text-2xl italic text-white [text-shadow:0_2px_12px_rgb(0_0_0/.5)]">
              Tạm hết hàng
            </span>
          )}
          <div className="absolute inset-x-3 bottom-3 translate-y-[130%] transition duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:translate-y-0 group-focus-within:translate-y-0 [@media(hover:none)]:translate-y-0">
            {product.is_drink ? (
              // Đồ uống: vào trang chi tiết để chọn size / đá / đường / topping
              <Link to={`/products/${product.slug}`} className={`${action} bg-caramel-500/95 text-white hover:bg-caramel-600`}>
                <SlidersHorizontal size={16} /> Chọn size · đá · đường
              </Link>
            ) : (
              <button
                className={`${action} bg-surface/95 text-coffee-900 hover:bg-espresso-900 hover:text-latte-50 disabled:cursor-not-allowed disabled:opacity-60`}
                disabled={!product.in_stock}
                onClick={(e) => addToCartWithToast(add, product, 1, undefined, e.currentTarget.closest('.group')?.querySelector('img'))}
              >
                <ShoppingBag size={16} /> {product.in_stock ? 'Thêm vào giỏ' : 'Hết hàng'}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col px-1 pt-4">
          <div className="flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-coffee-400">
            <span className="truncate">{product.category?.name}</span>
            {product.rating_count > 0 ? (
              <span className="flex shrink-0 items-center gap-1 normal-case tracking-normal"><Star size={12} className="text-caramel-500" fill="currentColor" strokeWidth={0} /> {product.rating_avg.toFixed(1)}</span>
            ) : <span className="shrink-0 text-caramel-600">Mới</span>}
          </div>
          <Link to={`/products/${product.slug}`} className="mt-1.5 line-clamp-2 font-display text-lg font-semibold leading-snug text-coffee-900 transition group-hover:text-caramel-600">
            {product.name}
          </Link>
          <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-2">
            {product.variants.length > 1 && <span className="text-xs text-coffee-400">từ</span>}
            <span className="font-semibold text-coffee-900">{formatVND(product.price)}</span>
            {off > 0 && <span className="text-xs text-coffee-300 line-through">{formatVND(product.original_price!)}</span>}
            {product.sold_count > 0 && <span className="ml-auto text-xs text-coffee-400">Đã bán {product.sold_count}</span>}
          </div>
        </div>
      </div>
    </Reveal>
  )
}

export function ProductCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-[4/5] rounded-[1.4rem]" />
      <div className="space-y-2 px-1 pt-4">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  )
}
