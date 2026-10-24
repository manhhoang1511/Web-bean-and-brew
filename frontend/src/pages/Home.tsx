import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Award, Coffee, Leaf, Truck } from 'lucide-react'
import { api } from '../api/client'
import type { Category, Page, Product } from '../api/types'
import ProductCard, { ProductCardSkeleton } from '../components/ProductCard'
import { useDocumentTitle } from '../lib/hooks'

const HERO_IMG = 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1400&q=80&auto=format&fit=crop'
const STORY_IMG = 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=1000&q=80&auto=format&fit=crop'

function ProductGrid({ products }: { products: Product[] | null }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
      {products
        ? products.map((p) => <ProductCard key={p.id} product={p} />)
        : Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}
    </div>
  )
}

function SectionHeader({ eyebrow, title, link }: { eyebrow: string; title: string; link?: string }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-caramel-600">{eyebrow}</p>
        <h2 className="mt-1 font-display text-3xl font-bold sm:text-4xl">{title}</h2>
      </div>
      {link && (
        <Link to={link} className="group hidden items-center gap-1 text-sm font-semibold text-coffee-700 hover:text-caramel-600 sm:flex">
          Xem tất cả <ArrowRight size={16} className="transition group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  )
}

export default function Home() {
  useDocumentTitle('')
  const [featured, setFeatured] = useState<Product[] | null>(null)
  const [bestsellers, setBestsellers] = useState<Product[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    api.get<Page<Product>>('/api/products', { params: { featured: true, page_size: 8, sort: 'rating' } }).then((r) => setFeatured(r.data.items))
    api.get<Page<Product>>('/api/products', { params: { sort: 'bestseller', page_size: 4 } }).then((r) => setBestsellers(r.data.items))
    api.get<Category[]>('/api/categories').then((r) => setCategories(r.data))
  }, [])

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO_IMG} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-espresso-900/95 via-espresso-900/75 to-espresso-900/20" />
        </div>
        <div className="container-page relative py-24 sm:py-32 lg:py-40">
          <div className="max-w-xl animate-slide-up">
            <span className="chip bg-caramel-500/20 px-3 py-1 text-caramel-400 ring-1 ring-caramel-500/40">☕ Rang mới mỗi thứ Hai</span>
            <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-latte-50 sm:text-6xl">
              Đánh thức ngày mới với <span className="text-caramel-400">hương vị thật</span>
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-latte-100">
              Cà phê specialty từ Cầu Đất, Buôn Ma Thuột đến Ethiopia – rang thủ công, giao tận nhà trong 48 giờ.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/shop" className="btn-accent rounded-full px-7 py-3.5 text-base">
                Mua ngay <ArrowRight size={18} />
              </Link>
              <Link to="/shop?category=ca-phe-hat" className="btn rounded-full border border-white/30 px-7 py-3.5 text-base text-white hover:bg-white/10">
                Khám phá cà phê hạt
              </Link>
            </div>
            <div className="mt-10 flex gap-8 text-latte-50">
              {[['24+', 'Sản phẩm'], ['4.8★', 'Đánh giá'], ['10k+', 'Khách hàng']].map(([n, l]) => (
                <div key={l}>
                  <p className="font-display text-2xl font-bold">{n}</p>
                  <p className="text-sm text-latte-200">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* USP */}
      <section className="container-page relative z-10 -mt-10">
        <div className="card grid grid-cols-2 gap-6 p-6 lg:grid-cols-4">
          {[
            [Truck, 'Miễn phí giao hàng', 'Cho đơn từ 500.000đ'],
            [Coffee, 'Rang xay tươi', 'Đóng gói ngay sau khi rang'],
            [Leaf, 'Nguồn gốc rõ ràng', 'Trực tiếp từ nông trại'],
            [Award, 'Đổi trả 7 ngày', 'Nếu không hài lòng'],
          ].map(([Icon, title, desc]) => {
            const I = Icon as typeof Truck
            return (
              <div key={title as string} className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-coffee-50 text-caramel-600"><I size={22} /></span>
                <div>
                  <p className="text-sm font-semibold">{title as string}</p>
                  <p className="text-xs text-coffee-400">{desc as string}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Danh mục */}
      <section className="container-page mt-20">
        <SectionHeader eyebrow="Danh mục" title="Bạn đang tìm gì?" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((c) => (
            <Link key={c.id} to={`/shop?category=${c.slug}`}
              className="group card flex flex-col items-center p-5 text-center transition hover:-translate-y-1 hover:border-caramel-400 hover:shadow-lg">
              <span className="text-4xl transition group-hover:scale-110">{c.icon}</span>
              <p className="mt-3 text-sm font-semibold">{c.name}</p>
              <p className="text-xs text-coffee-400">{c.product_count} sản phẩm</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Nổi bật */}
      <section className="container-page mt-20">
        <SectionHeader eyebrow="Tuyển chọn" title="Sản phẩm nổi bật" link="/shop" />
        <ProductGrid products={featured} />
      </section>

      {/* Câu chuyện */}
      <section className="container-page mt-24">
        <div className="grid items-center overflow-hidden rounded-3xl bg-espresso-800 lg:grid-cols-2">
          <img src={STORY_IMG} alt="Rang cà phê" className="h-72 w-full object-cover lg:h-full" />
          <div className="p-8 sm:p-12">
            <p className="text-sm font-semibold uppercase tracking-widest text-caramel-400">Câu chuyện của chúng tôi</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-latte-50">Từ nông trại đến tách cà phê của bạn</h2>
            <p className="mt-4 leading-relaxed text-latte-200">
              Chúng tôi làm việc trực tiếp với hơn 30 hộ nông dân ở Lâm Đồng và Đắk Lắk, thu mua giá công bằng và rang theo từng mẻ nhỏ
              để giữ trọn hương thơm. Không biết chọn loại nào? Hãy hỏi trợ lý <b className="text-caramel-400">Bean</b> ở góc phải màn hình!
            </p>
            <Link to="/shop" className="btn-accent mt-8 rounded-full px-6">Khám phá ngay <ArrowRight size={16} /></Link>
          </div>
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
