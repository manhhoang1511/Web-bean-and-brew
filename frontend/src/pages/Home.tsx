import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Award, Coffee, Flame, Leaf, Snowflake, Sparkles, Truck } from 'lucide-react'
import { api, imageUrl } from '../api/client'
import type { Category, Page, Product } from '../api/types'
import ProductCard, { ProductCardSkeleton } from '../components/ProductCard'
import Reveal from '../components/Reveal'
import { formatVND } from '../lib/format'
import { useDocumentTitle } from '../lib/hooks'
import HeroSlider from '../components/HeroSlider'

const STORY_IMG = 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=1000&q=80&auto=format&fit=crop'
const MARQUEE = ['Rang mới mỗi tuần', 'Arabica Cầu Đất', 'Robusta Buôn Ma Thuột', 'Pha tại quán', 'Miễn phí ship từ 500k',
  'Tùy chỉnh đá · đường · topping', 'Specialty Ethiopia', 'Trợ lý AI tư vấn 24/7']

function ProductGrid({ products }: { products: Product[] | null }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
      {products
        ? products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)
        : Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}
    </div>
  )
}

function SectionHeader({ eyebrow, title, link }: { eyebrow: string; title: string; link?: string }) {
  return (
    <Reveal className="mb-8 flex items-end justify-between gap-4">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-caramel-600">
          <span className="h-px w-8 bg-caramel-500" /> {eyebrow}
        </p>
        <h2 className="mt-1 font-display text-3xl font-bold sm:text-4xl">{title}</h2>
      </div>
      {link && (
        <Link to={link} className="group hidden items-center gap-1 text-sm font-semibold text-coffee-700 hover:text-caramel-600 sm:flex">
          Xem tất cả <ArrowRight size={16} className="transition group-hover:translate-x-1" />
        </Link>
      )}
    </Reveal>
  )
}

function Marquee() {
  const row = [...MARQUEE, ...MARQUEE] // nhân đôi để chạy vòng liền mạch (dịch -50%)
  return (
    <div className="group overflow-hidden border-y border-coffee-100 bg-caramel-500 py-3 text-white">
      <div className="flex w-max animate-marquee gap-10 group-hover:[animation-play-state:paused]">
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-10 whitespace-nowrap text-sm font-semibold uppercase tracking-widest">
            {t} <span className="text-white/60">✦</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function DrinksSection({ drinks }: { drinks: Product[] }) {
  if (!drinks.length) return null
  const [hero, ...rest] = drinks
  return (
    <section className="container-page mt-24">
      <SectionHeader eyebrow="Pha tại quán" title="Menu đồ uống theo gu của bạn" link="/shop?category=do-uong-pha-che" />
      <div className="grid gap-6 lg:grid-cols-5">
        <Reveal effect="left" className="lg:col-span-2">
          <Link to={`/products/${hero.slug}`} className="group relative block h-full min-h-80 overflow-hidden rounded-3xl">
            <img src={imageUrl(hero.image_url)} alt={hero.name} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-espresso-900/90 via-espresso-900/30 to-transparent" />
            <div className="relative flex h-full flex-col justify-end p-6 text-latte-50">
              <span className="chip mb-3 w-fit bg-caramel-500 text-white">⭐ Món được gọi nhiều nhất</span>
              <h3 className="font-display text-3xl font-bold">{hero.name}</h3>
              <p className="mt-2 line-clamp-2 text-sm text-latte-100">{hero.description}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {[[Snowflake, 'Chọn mức đá'], [Flame, 'Nóng / lạnh'], [Sparkles, 'Thêm topping']].map(([Icon, label]) => {
                  const I = Icon as typeof Snowflake
                  return <span key={label as string} className="chip bg-white/15 py-1 backdrop-blur"><I size={12} /> {label as string}</span>
                })}
              </div>
              <span className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-espresso-900 transition group-hover:gap-3">
                Tùy chỉnh ngay · từ {formatVND(hero.price)} <ArrowRight size={16} />
              </span>
            </div>
          </Link>
        </Reveal>
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:col-span-3 lg:grid-cols-3">
          {rest.slice(0, 6).map((p, i) => (
            <Reveal key={p.id} delay={i * 80} effect="zoom">
              <Link to={`/products/${p.slug}`} className="group card block overflow-hidden transition duration-500 hover:-translate-y-1.5 hover:shadow-xl">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img src={imageUrl(p.image_url)} alt={p.name} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-110 group-hover:rotate-1" />
                  <span className="absolute bottom-2 right-2 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-bold text-coffee-900 backdrop-blur transition group-hover:bg-caramel-500 group-hover:text-white">
                    {formatVND(p.price)}
                  </span>
                </div>
                <p className="truncate px-3 py-2.5 text-sm font-semibold group-hover:text-caramel-600">{p.name}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function Home() {
  useDocumentTitle('')
  const [featured, setFeatured] = useState<Product[] | null>(null)
  const [bestsellers, setBestsellers] = useState<Product[] | null>(null)
  const [drinks, setDrinks] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    api.get<Page<Product>>('/api/products', { params: { featured: true, page_size: 8, sort: 'rating' } }).then((r) => setFeatured(r.data.items))
    api.get<Page<Product>>('/api/products', { params: { sort: 'bestseller', page_size: 4 } }).then((r) => setBestsellers(r.data.items))
    api.get<Page<Product>>('/api/products', { params: { category: 'do-uong-pha-che', sort: 'bestseller', page_size: 7 } }).then((r) => setDrinks(r.data.items))
    api.get<Category[]>('/api/categories').then((r) => setCategories(r.data))
  }, [])

  return (
    <>
      <HeroSlider />

      {/* USP */}
      <section className="container-page relative z-10 mt-8">
        <div className="card grid grid-cols-2 gap-6 p-6 shadow-xl shadow-coffee-900/5 lg:grid-cols-4">
          {[
            [Truck, 'Miễn phí giao hàng', 'Cho đơn từ 500.000đ'],
            [Coffee, 'Rang xay tươi', 'Đóng gói ngay sau khi rang'],
            [Leaf, 'Nguồn gốc rõ ràng', 'Trực tiếp từ nông trại'],
            [Award, 'Đổi trả 7 ngày', 'Nếu không hài lòng'],
          ].map(([Icon, title, desc], i) => {
            const I = Icon as typeof Truck
            return (
              <Reveal key={title as string} delay={i * 100} className="group flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-coffee-50 text-caramel-600 transition duration-300 group-hover:-rotate-6 group-hover:scale-110 group-hover:bg-caramel-500 group-hover:text-white">
                  <I size={22} />
                </span>
                <div>
                  <p className="text-sm font-semibold">{title as string}</p>
                  <p className="text-xs text-coffee-400">{desc as string}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </section>

      <div className="mt-16"><Marquee /></div>

      {/* Danh mục */}
      <section className="container-page mt-20">
        <SectionHeader eyebrow="Danh mục" title="Bạn đang tìm gì?" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {categories.map((c, i) => (
            <Reveal key={c.id} delay={i * 60} effect="zoom">
              <Link to={`/shop?category=${c.slug}`}
                className="group card flex h-full flex-col items-center p-5 text-center transition duration-300 hover:-translate-y-1.5 hover:border-caramel-400 hover:shadow-lg">
                <span className="text-4xl transition duration-300 group-hover:animate-wiggle">{c.icon}</span>
                <p className="mt-3 text-sm font-semibold">{c.name}</p>
                <p className="text-xs text-coffee-400">{c.product_count} sản phẩm</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <DrinksSection drinks={drinks} />

      {/* Nổi bật */}
      <section className="container-page mt-24">
        <SectionHeader eyebrow="Tuyển chọn" title="Sản phẩm nổi bật" link="/shop" />
        <ProductGrid products={featured} />
      </section>

      {/* Câu chuyện */}
      <section className="container-page mt-24">
        <div className="grid items-center overflow-hidden rounded-3xl bg-espresso-800 lg:grid-cols-2">
          <Reveal effect="left" className="h-72 overflow-hidden lg:h-full">
            <img src={STORY_IMG} alt="Rang cà phê" className="h-full w-full object-cover transition duration-[2s] hover:scale-105" />
          </Reveal>
          <Reveal effect="right" delay={150} className="relative p-8 sm:p-12">
            {/* hơi nước bốc lên */}
            <div className="absolute right-10 top-8 flex gap-2" aria-hidden>
              {[0, 0.8, 1.6].map((dl) => (
                <span key={dl} className="h-10 w-2 rounded-full bg-white/20 blur-sm animate-steam" style={{ animationDelay: `${dl}s` }} />
              ))}
            </div>
            <p className="text-sm font-semibold uppercase tracking-widest text-caramel-400">Câu chuyện của chúng tôi</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-latte-50">Từ nông trại đến tách cà phê của bạn</h2>
            <p className="mt-4 leading-relaxed text-latte-200">
              Chúng tôi làm việc trực tiếp với hơn 30 hộ nông dân ở Lâm Đồng và Đắk Lắk, thu mua giá công bằng và rang theo từng mẻ nhỏ
              để giữ trọn hương thơm. Không biết chọn loại nào? Hãy hỏi trợ lý <b className="text-caramel-400">Bean</b> ở góc phải màn hình!
            </p>
            <Link to="/shop" className="btn-accent shine group mt-8 rounded-full px-6">
              Khám phá ngay <ArrowRight size={16} className="transition group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Bán chạy */}
      <section className="container-page mt-24">
        <SectionHeader eyebrow="Được yêu thích" title="Bán chạy nhất" link="/shop?sort=bestseller" />
        <ProductGrid products={bestsellers} />
      </section>
    </>
  )
}
