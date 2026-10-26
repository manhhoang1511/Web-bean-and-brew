import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PackageSearch, SlidersHorizontal, X } from 'lucide-react'
import { api, imageUrl } from '../api/client'
import type { Category, Page, Product } from '../api/types'
import ProductCard, { ProductCardSkeleton } from '../components/ProductCard'
import { EmptyState, Pagination } from '../components/ui'
import { formatShortVND } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'

const UNS = (id: string) => `https://images.unsplash.com/photo-${id}?w=1600&q=75&auto=format&fit=crop`
const SHOP_BANNERS: Record<string, string> = {
  '': UNS('1501339847302-ac426a4a7cbb'),
  'ca-phe-hat': '/static/products/arabica-son-la.jpg',
  'ca-phe-bot': '/static/products/bot-espresso-blend.jpg',
  'ca-phe-pha-san': UNS('1461023058943-07fcbe16d735'),
  'tra-matcha': '/static/products/tra-xanh-thai-nguyen.jpg',
  'dung-cu-pha-che': UNS('1442512595331-e89e73853f31'),
  'banh-do-an-kem': '/static/products/brownie-socola-cam.jpg',
  'do-uong-pha-che': UNS('1592663527359-cf6642f54cff'),
}

const SORTS = [
  ['newest', 'Mới nhất'],
  ['bestseller', 'Bán chạy'],
  ['rating', 'Đánh giá cao'],
  ['price_asc', 'Giá thấp → cao'],
  ['price_desc', 'Giá cao → thấp'],
]
const PRICE_PRESETS: [number | null, number | null][] = [
  [null, 100000], [100000, 200000], [200000, 300000], [300000, null],
]

function Filters({ params, update }: {
  params: URLSearchParams
  update: (changes: Record<string, string | null>) => void
}) {
  const [min, setMin] = useState(params.get('min_price') ?? '')
  const [max, setMax] = useState(params.get('max_price') ?? '')
  useEffect(() => {
    setMin(params.get('min_price') ?? '')
    setMax(params.get('max_price') ?? '')
  }, [params])
  const curMin = params.get('min_price'), curMax = params.get('max_price')

  return (
    <div className="space-y-8">
      {/* Danh mục đã chuyển lên hàng nút lọc nhanh phía trên */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-coffee-400">Khoảng giá</h3>
        <div className="grid grid-cols-2 gap-2">
          {PRICE_PRESETS.map(([lo, hi]) => {
            const selected = (curMin ?? null) === (lo?.toString() ?? null) && (curMax ?? null) === (hi?.toString() ?? null)
            return (
              <button key={`${lo}-${hi}`}
                onClick={() => update(selected ? { min_price: null, max_price: null } : { min_price: lo?.toString() ?? null, max_price: hi?.toString() ?? null })}
                className={`rounded-xl border px-2 py-2 text-xs font-medium transition ${selected ? 'border-caramel-500 bg-caramel-500/10 text-caramel-600' : 'border-coffee-100 hover:border-coffee-300'}`}>
                {lo === null ? `Dưới ${formatShortVND(hi!)}` : hi === null ? `Trên ${formatShortVND(lo)}` : `${formatShortVND(lo)} – ${formatShortVND(hi)}`}
              </button>
            )
          })}
        </div>
        <form className="mt-3 flex items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); update({ min_price: min || null, max_price: max || null }) }}>
          <input className="input px-2.5 py-2" placeholder="Từ" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} />
          <span className="text-coffee-300">–</span>
          <input className="input px-2.5 py-2" placeholder="Đến" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} />
          <button className="btn-outline px-3 py-2">OK</button>
        </form>
      </div>

      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-coffee-100 bg-surface px-3 py-2.5 text-sm font-medium">
        Chỉ hiện còn hàng
        <input type="checkbox" className="h-4 w-4 accent-caramel-500" checked={params.get('in_stock') === 'true'}
          onChange={(e) => update({ in_stock: e.target.checked ? 'true' : null })} />
      </label>
    </div>
  )
}

export default function Shop() {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<Page<Product> | null>(null)
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [showFilters, setShowFilters] = useState(false)

  const q = params.get('q') ?? ''
  const currentCat = categories.find((c) => c.slug === params.get('category'))
  useDocumentTitle(q ? `Tìm "${q}"` : currentCat?.name ?? 'Cửa hàng')

  useEffect(() => { api.get<Category[]>('/api/categories').then((r) => setCategories(r.data)) }, [])

  useEffect(() => {
    setLoading(true)
    api.get<Page<Product>>('/api/products', { params: { ...Object.fromEntries(params), page_size: 12 } })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false))
  }, [params])

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    if (!('page' in changes)) next.delete('page')
    setParams(next)
    setShowFilters(false)
  }

  const chips: [string, string][] = []
  if (q) chips.push(['q', `“${q}”`])
  if (currentCat) chips.push(['category', currentCat.name])
  if (params.get('min_price') || params.get('max_price'))
    chips.push(['price', `${formatShortVND(+(params.get('min_price') ?? 0))} – ${params.get('max_price') ? formatShortVND(+params.get('max_price')!) : '∞'}`])
  if (params.get('in_stock')) chips.push(['in_stock', 'Còn hàng'])

  return (
    <div className="container-page py-8">
      {/* Banner cửa hàng: ảnh + tiêu đề đổi theo danh mục đang xem */}
      <div className="relative mb-6 overflow-hidden rounded-[2rem] bg-espresso-900 text-latte-50">
        <img key={currentCat?.slug ?? 'all'} src={imageUrl(SHOP_BANNERS[currentCat?.slug ?? ''] ?? SHOP_BANNERS[''])} alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-60 animate-kenburns" />
        <div className="absolute inset-0 bg-gradient-to-r from-espresso-900/95 via-espresso-900/60 to-transparent" />
        <div key={`${currentCat?.slug}-${q}`} className="relative px-6 py-10 sm:px-10 sm:py-14">
          <p className="slide-text text-sm font-semibold uppercase tracking-widest text-caramel-400">
            {q ? 'Kết quả tìm kiếm' : 'Cửa hàng Bean & Brew'}
          </p>
          <h1 className="slide-text mt-2 font-display text-3xl font-bold sm:text-5xl" style={{ animationDelay: '.08s' }}>
            {q ? `“${q}”` : currentCat ? `${currentCat.icon} ${currentCat.name}` : 'Tất cả sản phẩm'}
          </h1>
          <p className="slide-text mt-2 max-w-lg text-latte-200" style={{ animationDelay: '.16s' }}>
            {currentCat?.description ?? 'Cà phê, trà, đồ uống pha chế và mọi thứ cho tách cà phê hoàn hảo – chọn món và thêm vào giỏ ngay.'}
          </p>
        </div>
      </div>

      {/* Lọc nhanh theo danh mục */}
      <div className="scrollbar-thin -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1">
        {[{ slug: '', name: 'Tất cả', icon: '✨', product_count: categories.reduce((n, c) => n + (c.product_count ?? 0), 0) }, ...categories].map((c) => {
          const active = (params.get('category') ?? '') === c.slug
          return (
            <button key={c.slug || 'all'} onClick={() => update({ category: c.slug || null })}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition duration-300 active:scale-95 ${
                active ? 'border-coffee-800 bg-coffee-800 text-cream-50 shadow-md' : 'border-coffee-100 bg-surface hover:-translate-y-0.5 hover:border-coffee-300'}`}>
              <span>{c.icon}</span> {c.name}
              <span className={`rounded-full px-1.5 text-xs ${active ? 'bg-white/20' : 'bg-coffee-50 text-coffee-400'}`}>{c.product_count}</span>
            </button>
          )
        })}
      </div>

      <div className="flex gap-10">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24"><Filters params={params} update={update} /></div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <button className="btn-outline lg:hidden" onClick={() => setShowFilters(true)}><SlidersHorizontal size={16} /> Bộ lọc</button>
            <p className="text-sm text-coffee-500">{data ? <><b className="text-coffee-900">{data.total}</b> sản phẩm</> : '…'}</p>
            <div className="flex flex-wrap gap-2">
              {chips.map(([key, label]) => (
                <button key={key} className="chip bg-coffee-100 py-1 text-coffee-700 hover:bg-coffee-200"
                  onClick={() => update(key === 'price' ? { min_price: null, max_price: null } : { [key]: null })}>
                  {label} <X size={12} />
                </button>
              ))}
            </div>
            <select className="input ml-auto w-auto py-2 pr-8" value={params.get('sort') ?? 'newest'} onChange={(e) => update({ sort: e.target.value })}>
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          {loading && !data ? (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
          ) : data && data.items.length > 0 ? (
            <>
              <div className={`grid grid-cols-2 gap-4 transition sm:gap-6 xl:grid-cols-3 ${loading ? 'opacity-50' : ''}`}>
                {data.items.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
              </div>
              <div className="mt-10">
                <Pagination page={data.page} pages={data.pages} onChange={(p) => { update({ page: String(p) }); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
              </div>
            </>
          ) : (
            <EmptyState icon={<PackageSearch size={30} />} title="Không tìm thấy sản phẩm" desc="Thử bỏ bớt bộ lọc hoặc tìm với từ khóa khác nhé."
              action={<button className="btn-outline" onClick={() => setParams({})}>Xóa bộ lọc</button>} />
          )}
        </div>
      </div>

      {showFilters && (
        <div className="fixed inset-0 z-50 bg-espresso-900/40 lg:hidden" onClick={() => setShowFilters(false)}>
          <div className="ml-auto h-full w-80 max-w-[85vw] overflow-y-auto bg-cream-50 p-5 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Bộ lọc</h2>
              <button onClick={() => setShowFilters(false)} aria-label="Đóng"><X /></button>
            </div>
            <Filters params={params} update={update} />
          </div>
        </div>
      )}
    </div>
  )
}
