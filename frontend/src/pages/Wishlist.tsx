import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { api } from '../api/client'
import type { Product } from '../api/types'
import ProductCard, { ProductCardSkeleton } from '../components/ProductCard'
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
    <div className="container-page py-10">
      <h1 className="font-display text-3xl font-bold">Sản phẩm yêu thích</h1>
      <p className="mt-1 text-coffee-500">Lưu lại những món bạn muốn thử – giá và tồn kho luôn được cập nhật.</p>
      <div className="mt-8">
        {!shown ? (
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
        ) : shown.length === 0 ? (
          <EmptyState icon={<Heart size={30} />} title="Chưa có sản phẩm yêu thích" desc="Bấm biểu tượng trái tim trên sản phẩm để lưu lại."
            action={<Link to="/shop" className="btn-primary">Khám phá cửa hàng</Link>} />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {shown.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}
