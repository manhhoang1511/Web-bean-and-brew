import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product, Variant } from '../api/types'

/** Chỉ lưu thông tin tối thiểu; giá cuối cùng luôn do server tính khi đặt hàng. */
export type CartProduct = Pick<Product, 'id' | 'name' | 'slug' | 'price' | 'image_url' | 'stock'>

export interface CartItem {
  key: string // sản phẩm + biến thể + kiểu xay
  product: CartProduct
  variant: Variant | null
  grind: string | null
  quantity: number
}

interface CartState {
  items: CartItem[]
  add: (product: CartProduct, quantity?: number, variant?: Variant | null, grind?: string | null) => void
  setQuantity: (key: string, quantity: number) => void
  remove: (key: string) => void
  syncProducts: (products: Product[]) => void
  clear: () => void
}

export const itemKey = (productId: number, variantId?: number | null, grind?: string | null) =>
  `${productId}-${variantId ?? 0}-${grind ?? ''}`

/** Giá & tồn kho của 1 dòng: theo biến thể nếu có */
export const unitPrice = (i: CartItem) => i.variant?.price ?? i.product.price
export const lineStock = (i: CartItem) => i.variant?.stock ?? i.product.stock
export const lineLabel = (i: CartItem) => [i.variant?.label, i.grind].filter(Boolean).join(' · ')

const pick = (p: CartProduct): CartProduct => ({
  id: p.id, name: p.name, slug: p.slug, price: p.price, image_url: p.image_url, stock: p.stock,
})

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (product, quantity = 1, variant = null, grind = null) =>
        set((s) => {
          const key = itemKey(product.id, variant?.id, grind)
          const max = variant?.stock ?? product.stock
          const existing = s.items.find((i) => i.key === key)
          if (existing) {
            return { items: s.items.map((i) => (i.key === key ? { ...i, quantity: Math.min(i.quantity + quantity, max) } : i)) }
          }
          return { items: [...s.items, { key, product: pick(product), variant, grind, quantity: Math.min(quantity, max) }] }
        }),
      setQuantity: (key, quantity) =>
        set((s) => ({
          items: s.items.map((i) => (i.key === key ? { ...i, quantity: Math.max(1, Math.min(quantity, lineStock(i))) } : i)),
        })),
      remove: (key) => set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
      // Cập nhật giá / tồn kho mới nhất từ server; bỏ dòng có biến thể đã bị xóa
      syncProducts: (products) =>
        set((s) => ({
          items: s.items.flatMap((i) => {
            const fresh = products.find((p) => p.id === i.product.id)
            if (!fresh) return [i]
            const variant = i.variant ? fresh.variants.find((v) => v.id === i.variant!.id) ?? null : null
            if (i.variant && !variant) return []
            const stock = variant?.stock ?? fresh.stock
            return [{ ...i, product: pick(fresh), variant, quantity: Math.min(i.quantity, Math.max(stock, 1)) }]
          }),
        })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'bb-cart',
      version: 2,
      migrate: () => ({ items: [] }), // giỏ hàng định dạng cũ (chưa có biến thể) -> làm trống
    },
  ),
)

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.quantity, 0)
export const cartSubtotal = (items: CartItem[]) => items.reduce((n, i) => n + i.quantity * unitPrice(i), 0)
