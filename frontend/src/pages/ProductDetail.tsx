import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { BadgeCheck, ChevronRight, MessageSquare, ShieldCheck, ShoppingBag, Truck, Zap } from 'lucide-react'
import { api, errorMessage, imageUrl } from '../api/client'
import type { Product, Review } from '../api/types'
import ProductCard, { HeartButton, addToCartWithToast, defaultVariant } from '../components/ProductCard'
import { useMeta } from '../lib/meta'
import { EmptyState, PageLoader, QuantityInput, Spinner, Stars } from '../components/ui'
import { useAuth } from '../store/auth'
import { useCart } from '../store/cart'
import { discountPercent, formatDate, formatVND } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'

function ReviewSection({ product, onRated }: { product: Product; onRated: () => void }) {
  const user = useAuth((s) => s.user)
  const [reviews, setReviews] = useState<Review[]>([])
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  const [canReview, setCanReview] = useState(false)

  const load = () => api.get<Review[]>(`/api/products/${product.id}/reviews`).then((r) => setReviews(r.data))
  useEffect(() => { load() }, [product.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user) return setCanReview(false)
    api.get<{ can_review: boolean }>(`/api/products/${product.id}/review-eligibility`)
      .then((r) => setCanReview(r.data.can_review)).catch(() => setCanReview(false))
  }, [product.id, user])

  const mine = reviews.find((r) => r.user.id === user?.id)
  useEffect(() => {
    if (mine) { setRating(mine.rating); setComment(mine.comment) }
  }, [mine?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post(`/api/products/${product.id}/reviews`, { rating, comment })
      toast.success(mine ? 'Đã cập nhật đánh giá' : 'Cảm ơn bạn đã đánh giá!')
      await load()
      onRated()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const dist = [5, 4, 3, 2, 1].map((s) => [s, reviews.filter((r) => r.rating === s).length])

  return (
    <section className="mt-16" id="reviews">
      <h2 className="font-display text-2xl font-bold">Đánh giá từ khách hàng</h2>
      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <p className="font-display text-5xl font-bold">{product.rating_avg.toFixed(1)}</p>
              <div>
                <Stars value={product.rating_avg} size={18} />
                <p className="mt-1 text-sm text-coffee-400">{product.rating_count} đánh giá</p>
              </div>
            </div>
            <div className="mt-5 space-y-1.5">
              {dist.map(([s, n]) => (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-coffee-500">{s}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-coffee-50">
                    <div className="h-full rounded-full bg-caramel-500" style={{ width: `${reviews.length ? (n / reviews.length) * 100 : 0}%` }} />
                  </div>
                  <span className="w-5 text-right text-coffee-400">{n}</span>
                </div>
              ))}
            </div>
          </div>

          {user && !canReview ? (
            <div className="card flex items-start gap-3 p-6 text-sm text-coffee-500">
              <BadgeCheck size={20} className="shrink-0 text-coffee-300" />
              <p>Chỉ khách hàng đã mua và <b>nhận hàng thành công</b> sản phẩm này mới có thể đánh giá – giúp mọi đánh giá đều đáng tin cậy.</p>
            </div>
          ) : user ? (
            <form onSubmit={submit} className="card space-y-3 p-6">
              <p className="font-semibold">{mine ? 'Sửa đánh giá của bạn' : 'Viết đánh giá'}</p>
              <Stars value={rating} size={26} onChange={setRating} />
              <textarea className="input min-h-24" placeholder="Chia sẻ cảm nhận về sản phẩm…" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
              <button className="btn-primary w-full" disabled={saving}>{saving && <Spinner className="h-4 w-4" />} Gửi đánh giá</button>
            </form>
          ) : (
            <div className="card p-6 text-center text-sm text-coffee-500">
              <Link to="/login" className="font-semibold text-caramel-600 hover:underline">Đăng nhập</Link> để viết đánh giá
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {reviews.length === 0 ? (
            <div className="card"><EmptyState icon={<MessageSquare size={28} />} title="Chưa có đánh giá" desc="Hãy là người đầu tiên đánh giá sản phẩm này!" /></div>
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => (
                <div key={r.id} className="card p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-coffee-100 font-semibold text-coffee-700">
                      {r.user.full_name.charAt(0)}
                    </span>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{r.user.full_name}</p>
                        {r.verified_purchase && (
                          <span className="chip bg-emerald-50 text-emerald-700"><BadgeCheck size={12} /> Đã mua hàng</span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <Stars value={r.rating} size={13} />
                        <span className="text-xs text-coffee-300">{formatDate(r.created_at, false)}</span>
                      </div>
                      {r.comment && <p className="mt-2 text-sm leading-relaxed text-coffee-700">{r.comment}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default function ProductDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const add = useCart((s) => s.add)
  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<Product[]>([])
  const [notFound, setNotFound] = useState(false)
  const [activeImg, setActiveImg] = useState(0)
  const [qty, setQty] = useState(1)
  const [variantId, setVariantId] = useState<number | null>(null)
  const [grind, setGrind] = useState<string | null>(null)
  const { grind_options, free_shipping_threshold } = useMeta()
  useDocumentTitle(product?.name ?? '')

  const load = () =>
    api.get<Product>(`/api/products/${slug}`).then((r) => { setProduct(r.data); return r.data }).catch(() => { setNotFound(true); return null })

  useEffect(() => {
    setProduct(null); setNotFound(false); setActiveImg(0); setQty(1)
    load().then((p) => {
      setVariantId(p ? defaultVariant(p)?.id ?? null : null)
      setGrind(p?.has_grind_option ? 'Nguyên hạt' : null)
    })
    api.get<Product[]>(`/api/products/${slug}/related`).then((r) => setRelated(r.data)).catch(() => {})
  }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  if (notFound) return <EmptyState icon={<ShoppingBag size={30} />} title="Không tìm thấy sản phẩm" action={<Link to="/shop" className="btn-primary">Về cửa hàng</Link>} />
  if (!product) return <PageLoader />

  // Giá & tồn kho theo biến thể đang chọn
  const variant = product.variants.find((v) => v.id === variantId) ?? null
  const price = variant?.price ?? product.price
  const originalPrice = variant ? variant.original_price : product.original_price
  const stock = variant?.stock ?? product.stock
  const off = discountPercent(price, originalPrice)
  const chip = (selected: boolean, disabled = false) =>
    `rounded-xl border-2 px-4 py-2 text-sm font-medium transition ${selected ? 'border-caramel-500 bg-caramel-500/10 text-coffee-900'
      : disabled ? 'cursor-not-allowed border-dashed border-coffee-100 text-coffee-300 line-through' : 'border-coffee-100 hover:border-coffee-300'}`
  const specs = [
    ['Xuất xứ', product.origin], ['Mức rang', product.roast_level], ['Khối lượng', product.weight], ['Danh mục', product.category?.name],
  ].filter(([, v]) => v)

  return (
    <div className="container-page py-8">
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-coffee-400">
        <Link to="/" className="hover:text-coffee-700">Trang chủ</Link><ChevronRight size={14} />
        <Link to="/shop" className="hover:text-coffee-700">Cửa hàng</Link><ChevronRight size={14} />
        {product.category && <><Link to={`/shop?category=${product.category.slug}`} className="hover:text-coffee-700">{product.category.name}</Link><ChevronRight size={14} /></>}
        <span className="truncate text-coffee-700">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <div className="card relative aspect-square overflow-hidden">
            <img src={imageUrl(product.gallery[activeImg] ?? product.image_url)} alt={product.name} className="h-full w-full object-cover animate-fade-in" key={activeImg} />
            {off > 0 && <span className="chip absolute left-4 top-4 bg-rose-500 px-3 py-1 text-sm text-white">-{off}%</span>}
          </div>
          {product.gallery.length > 1 && (
            <div className="mt-4 flex gap-3">
              {product.gallery.map((g, i) => (
                <button key={g} onClick={() => setActiveImg(i)}
                  className={`h-20 w-20 overflow-hidden rounded-xl border-2 transition ${i === activeImg ? 'border-caramel-500' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                  <img src={imageUrl(g)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-caramel-600">{product.category?.name}</p>
          <div className="mt-2 flex items-start justify-between gap-4">
            <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">{product.name}</h1>
            <HeartButton product={product} className="h-11 w-11 shrink-0 border border-coffee-100 bg-surface" />
          </div>
          <a href="#reviews" className="mt-3 flex items-center gap-2 text-sm text-coffee-500">
            <Stars value={product.rating_avg} size={16} />
            <span className="font-semibold text-coffee-800">{product.rating_avg.toFixed(1)}</span>
            <span>({product.rating_count} đánh giá)</span>
            <span className="text-coffee-200">|</span>
            <span>Đã bán {product.sold_count}</span>
          </a>

          <div className="mt-6 flex items-end gap-3">
            <p className="text-4xl font-bold text-coffee-900">{formatVND(price)}</p>
            {off > 0 && <p className="pb-1 text-lg text-coffee-300 line-through">{formatVND(originalPrice!)}</p>}
          </div>

          <p className="mt-6 leading-relaxed text-coffee-600">{product.description}</p>

          {specs.length > 0 && (
            <dl className="mt-6 grid grid-cols-2 gap-3">
              {specs.map(([k, v]) => (
                <div key={k} className="rounded-xl bg-cream-100 px-4 py-3">
                  <dt className="text-xs text-coffee-400">{k}</dt>
                  <dd className="text-sm font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-8 space-y-5 border-t border-coffee-100 pt-6">
            {product.variants.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold">Khối lượng</p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => (
                    <button key={v.id} className={chip(v.id === variantId, v.stock === 0)} disabled={v.stock === 0}
                      onClick={() => { setVariantId(v.id); setQty(1) }} title={v.stock === 0 ? 'Hết hàng' : formatVND(v.price)}>
                      {v.label} <span className="ml-1 text-xs text-coffee-400">{formatVND(v.price)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {product.has_grind_option && (
              <div>
                <p className="mb-2 text-sm font-semibold">Kiểu xay</p>
                <div className="flex flex-wrap gap-2">
                  {grind_options.map((g) => (
                    <button key={g} className={chip(g === grind)} onClick={() => setGrind(g)}>{g}</button>
                  ))}
                </div>
              </div>
            )}
            <p className="text-sm">
              {stock > 0 ? (
                <span className={stock <= 5 ? 'font-semibold text-amber-600' : 'text-emerald-600'}>
                  ● {stock <= 5 ? `Chỉ còn ${stock} sản phẩm` : `Còn hàng (${stock})`}
                </span>
              ) : <span className="font-semibold text-rose-600">● Tạm hết hàng</span>}
            </p>
            {stock > 0 && (
              <div className="flex flex-wrap gap-3">
                <QuantityInput value={Math.min(qty, stock)} max={stock} onChange={setQty} />
                <button className="btn-outline h-11 flex-1 px-6" onClick={() => addToCartWithToast(add, product, qty, variant, grind)}>
                  <ShoppingBag size={18} /> Thêm vào giỏ
                </button>
                <button className="btn-accent h-11 flex-1 px-6" onClick={() => { add(product, qty, variant, grind); navigate('/cart') }}>
                  <Zap size={18} /> Mua ngay
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border border-coffee-100 p-3 text-sm"><Truck size={20} className="text-caramel-600" /> Miễn phí ship đơn từ {formatVND(free_shipping_threshold)}</div>
            <div className="flex items-center gap-3 rounded-xl border border-coffee-100 p-3 text-sm"><ShieldCheck size={20} className="text-caramel-600" /> Đổi trả trong 7 ngày</div>
          </div>
        </div>
      </div>

      <ReviewSection product={product} onRated={load} />

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-2xl font-bold">Có thể bạn cũng thích</h2>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  )
}
