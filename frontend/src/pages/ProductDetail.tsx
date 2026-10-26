import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { BadgeCheck, MessageSquare, ShieldCheck, ShoppingBag, Truck, Zap } from 'lucide-react'
import { api, errorMessage, imageUrl } from '../api/client'
import type { CartTopping, Product, Review } from '../api/types'
import ProductCard, { HeartButton, addToCartWithToast, defaultVariant } from '../components/ProductCard'
import DrinkOptions from '../components/DrinkOptions'
import { DEFAULT_META, useMeta } from '../lib/meta'
import { type LineOptions, optionsLabel, toppingsTotal } from '../store/cart'
import { EmptyState, PageLoader, QuantityInput, Spinner, Stars } from '../components/ui'
import { useAuth } from '../store/auth'
import { useCart } from '../store/cart'
import { discountPercent, formatDate, formatVND } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'
import { SectionHeader } from '../components/home/HomeSections'

/** Ảnh lớn có "kính lúp": rê chuột -> phóng to đúng vị trí con trỏ (đổi transform-origin) */
function Magnifier({ src, alt, children }: { src: string; alt: string; children?: React.ReactNode }) {
  const [origin, setOrigin] = useState<string | null>(null)
  return (
    <div className="relative aspect-[4/5] flex-1 cursor-zoom-in overflow-hidden rounded-[2rem] bg-cream-100"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`)
      }}
      onMouseLeave={() => setOrigin(null)}>
      <img src={src} alt={alt} className="h-full w-full object-cover transition-transform duration-300 ease-out animate-fade-in"
        style={{ transformOrigin: origin ?? '50% 50%', transform: origin ? 'scale(1.8)' : 'none' }} />
      {children}
    </div>
  )
}

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
    <section className="mt-28 scroll-mt-24" id="reviews">
      <SectionHeader eyebrow="Đánh giá" title="Khách hàng nói gì" />
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-4">
              <p className="font-display text-6xl font-semibold">{product.rating_avg.toFixed(1)}</p>
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
            <div className="divide-y divide-coffee-100 border-y border-coffee-100">
              {reviews.map((r) => (
                <div key={r.id} className="py-6">
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
                      {r.comment && <p className="mt-3 font-display text-lg leading-relaxed text-coffee-800">“{r.comment}”</p>}
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
  const [sugar, setSugar] = useState(DEFAULT_META.default_sugar)
  const [ice, setIce] = useState(DEFAULT_META.default_ice)
  const [toppingQty, setToppingQty] = useState<Record<number, number>>({})
  const meta = useMeta()
  const { grind_options, free_shipping_threshold } = meta
  useDocumentTitle(product?.name ?? '')

  const load = () =>
    api.get<Product>(`/api/products/${slug}`).then((r) => { setProduct(r.data); return r.data }).catch(() => { setNotFound(true); return null })

  useEffect(() => {
    setProduct(null); setNotFound(false); setActiveImg(0); setQty(1)
    load().then((p) => {
      setVariantId(p ? defaultVariant(p)?.id ?? null : null)
      setGrind(p?.has_grind_option ? 'Nguyên hạt' : null)
      setSugar(DEFAULT_META.default_sugar); setIce(DEFAULT_META.default_ice); setToppingQty({})
    })
    api.get<Product[]>(`/api/products/${slug}/related`).then((r) => setRelated(r.data)).catch(() => {})
  }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  if (notFound) return <EmptyState icon={<ShoppingBag size={30} />} title="Không tìm thấy sản phẩm" action={<Link to="/shop" className="btn-primary">Về cửa hàng</Link>} />
  if (!product) return <PageLoader />

  // Giá & tồn kho theo biến thể đang chọn
  const variant = product.variants.find((v) => v.id === variantId) ?? null
  // Đồ uống: topping đã chọn (kèm tên + giá) để tính tiền và hiển thị
  const toppings: CartTopping[] = meta.toppings
    .filter((t) => toppingQty[t.id])
    .map((t) => ({ id: t.id, name: t.name, price: t.price, quantity: toppingQty[t.id] }))
  const options: LineOptions = {
    variant, grind,
    sugar: product.is_drink ? sugar : null,
    ice: product.is_drink ? ice : null,
    toppings: product.allow_toppings ? toppings : [],
  }
  const price = (variant?.price ?? product.price) + toppingsTotal(options.toppings)
  const originalPrice = variant ? variant.original_price : product.original_price
  const stock = variant?.stock ?? product.stock
  const off = discountPercent(price, originalPrice)
  const chip = (selected: boolean, disabled = false) =>
    `rounded-full border px-4 py-2 text-sm font-medium transition ${selected ? 'border-coffee-900 bg-coffee-900 text-cream-50'
      : disabled ? 'cursor-not-allowed border-dashed border-coffee-100 text-coffee-300 line-through' : 'border-coffee-200 hover:border-coffee-500'}`
  const specs = [
    ['Xuất xứ', product.origin], ['Mức rang', product.roast_level], [product.is_drink ? 'Kích cỡ' : 'Khối lượng', product.weight], ['Danh mục', product.category?.name],
  ].filter(([, v]) => v)

  return (
    <div className="container-page pb-8 pt-8">
      <nav aria-label="Đường dẫn" className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium uppercase tracking-[0.22em] text-coffee-400">
        <Link to="/" className="hover:text-caramel-600">Trang chủ</Link><span>/</span>
        <Link to="/shop" className="hover:text-caramel-600">Cửa hàng</Link><span>/</span>
        {product.category && <><Link to={`/shop?category=${product.category.slug}`} className="hover:text-caramel-600">{product.category.name}</Link><span>/</span></>}
        <span className="truncate text-coffee-800">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16 [&>*]:min-w-0">
        {/* Ảnh lớn dính khi cuộn phần thông tin; rê chuột để soi chi tiết (kính lúp) */}
        <div className="lg:col-span-7">
          <div className="lg:sticky lg:top-24 lg:flex lg:flex-row-reverse lg:gap-4">
            <Magnifier src={imageUrl(product.gallery[activeImg] ?? product.image_url)} alt={product.name} key={activeImg}>
              {off > 0 && <span className="chip absolute left-5 top-5 bg-caramel-500 px-3 py-1 text-sm font-semibold text-white">-{off}%</span>}
            </Magnifier>
            {product.gallery.length > 1 && (
              <div className="mt-4 flex gap-3 lg:mt-0 lg:flex-col">
                {product.gallery.map((g, i) => (
                  <button key={g} onClick={() => setActiveImg(i)} aria-label={`Ảnh ${i + 1}`}
                    className={`h-20 w-16 overflow-hidden rounded-xl transition lg:h-24 lg:w-20 ${i === activeImg ? 'ring-2 ring-caramel-500 ring-offset-2 ring-offset-cream-50' : 'opacity-60 hover:opacity-100'}`}>
                    <img src={imageUrl(g)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5">
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-caramel-600"><span className="h-px w-8 bg-caramel-500" /> {product.category?.name}</p>
          <div className="mt-4 flex items-start justify-between gap-4">
            <h1 className="font-display text-[clamp(2.3rem,3.6vw,3.6rem)] font-semibold leading-[1.04] tracking-tight">{product.name}</h1>
            <HeartButton product={product} className="mt-2 h-12 w-12 shrink-0 border border-coffee-200 bg-surface" />
          </div>
          <a href="#reviews" className="mt-4 flex items-center gap-2 text-sm text-coffee-500">
            <Stars value={product.rating_avg} size={15} />
            <span className="font-semibold text-coffee-800">{product.rating_avg.toFixed(1)}</span>
            <span className="link-underline">{product.rating_count} đánh giá</span>
            <span className="text-coffee-200">·</span>
            <span>Đã bán {product.sold_count}</span>
          </a>

          <div className="mt-7 flex items-baseline gap-3">
            <p key={price} className="font-display text-4xl font-semibold text-coffee-900 animate-pop sm:text-5xl">{formatVND(price)}</p>
            {off > 0 && <p className="text-lg text-coffee-300 line-through">{formatVND(originalPrice!)}</p>}
          </div>

          <p className="mt-6 leading-relaxed text-coffee-600">{product.description}</p>

          {specs.length > 0 && (
            <dl className="mt-7 divide-y divide-coffee-100 border-y border-coffee-100">
              {specs.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.2em] text-coffee-400">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-8 space-y-6">
            {product.variants.length > 0 && (
              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-coffee-500">{product.is_drink ? 'Size' : 'Khối lượng'}</p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => (
                    <button key={v.id} className={chip(v.id === variantId, v.stock === 0)} disabled={v.stock === 0}
                      onClick={() => { setVariantId(v.id); setQty(1) }} title={v.stock === 0 ? 'Hết hàng' : formatVND(v.price)}>
                      {v.label} <span className="ml-1 text-xs opacity-60">{formatVND(v.price)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {product.is_drink && (
              <DrinkOptions meta={meta} sugar={sugar} ice={ice} toppingQty={toppingQty} allowToppings={product.allow_toppings}
                onSugar={setSugar} onIce={setIce} onTopping={(id, q) => setToppingQty((m) => ({ ...m, [id]: q }))} />
            )}
            {product.has_grind_option && (
              <div>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-coffee-500">Kiểu xay</p>
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
            {stock > 0 && product.is_drink && (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-espresso-900 px-5 py-3.5 text-sm text-latte-100 animate-fade-in">
                <span className="min-w-0 truncate">☕ {optionsLabel(options)}</span>
                <span className="shrink-0 font-semibold text-latte-50">
                  {qty > 1 && <span className="mr-1 font-normal text-latte-300">{formatVND(price)} × {qty} =</span>}
                  <span key={price * qty} className="inline-block animate-pop">{formatVND(price * qty)}</span>
                </span>
              </div>
            )}
            {stock > 0 && (
              <div className="flex flex-wrap gap-3">
                <QuantityInput value={Math.min(qty, stock)} max={stock} onChange={setQty} />
                <button className="btn-outline h-12 min-w-[10rem] flex-1 whitespace-nowrap px-6" onClick={(e) => addToCartWithToast(add, product, qty, options, e.currentTarget)}>
                  <ShoppingBag size={18} /> Thêm vào giỏ
                </button>
                <button className="btn-primary shine h-12 min-w-[10rem] flex-1 whitespace-nowrap px-6" onClick={() => { add(product, qty, options); navigate('/cart') }}>
                  <Zap size={18} /> Mua ngay
                </button>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-coffee-100 pt-6 text-sm text-coffee-600">
            <div className="flex items-center gap-3"><Truck size={18} className="text-caramel-600" /> Miễn phí ship đơn từ {formatVND(free_shipping_threshold)}</div>
            <div className="flex items-center gap-3"><ShieldCheck size={18} className="text-caramel-600" /> Đổi trả trong 7 ngày</div>
          </div>
        </div>
      </div>

      <ReviewSection product={product} onRated={load} />

      {related.length > 0 && (
        <section className="mt-28">
          <SectionHeader eyebrow="Gợi ý" title="Có thể bạn cũng thích" link={product.category ? `/shop?category=${product.category.slug}` : '/shop'} />
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
            {related.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        </section>
      )}
    </div>
  )
}
