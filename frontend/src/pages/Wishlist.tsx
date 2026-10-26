import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { api } from '../api/client'
import type { Product } from '../api/types'
import ProductCard, { ProductCardSkeleton } from '../components/ProductCard'
import PageHero, { HeroStat } from '../components/PageHero'
import { EmptyState } from '../components/ui'
import { useWishlist } from '../store/wishlist'
import { useDocumentTitle } from '../lib/hooks'

export default function Wishlist() {
  useDocumentTitle('Yêu thích')
  const ids = useWishlist((s) => s.ids)
  const [products, setProducts] = useState<Product[] | null>(null)

  useEffect(() => {
    api.get<Product[]>('/api/wishlist').then((r) => setProducts(r.data))
  }, [])

  // Bỏ tim ngay trên trang -> ẩn khỏi danh sách
  const shown = products?.filter((p) => ids.includes(p.id))

  return (
    <div>
      <PageHero kicker="Bộ sưu tập riêng" title={['Những món', <em key="e">bạn yêu thích.</em>]}
        subtitle="Lưu lại những món bạn muốn thử – giá và tồn kho luôn được cập nhật."
        aside={shown?.length ? <HeroStat value={shown.length} label="sản phẩm đã lưu" /> : undefined}
        crumbs={[{ label: 'Yêu thích' }]} />
      <div className="container-page pt-12">
        {!shown ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
        ) : shown.length === 0 ? (
          <EmptyState icon={<Heart size={30} />} title="Chưa có sản phẩm yêu thích" desc="Bấm biểu tượng trái tim trên sản phẩm để lưu lại."
            action={<Link to="/shop" className="btn-primary">Khám phá cửa hàng</Link>} />
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-4">
            {shown.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        )}
      </div>
    </div>
  )
}
