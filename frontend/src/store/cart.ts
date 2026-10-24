import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '../api/types'

/** Chỉ lưu thông tin tối thiểu; giá cuối cùng luôn do server tính khi đặt hàng. */
export type CartProduct = Pick<Product, 'id' | 'name' | 'slug' | 'price' | 'image_url' | 'stock'>

export interface CartItem {
  product: CartProduct
  quantity: number
}

interface CartState {
  items: CartItem[]
  add: (product: CartProduct, quantity?: number) => void
  setQuantity: (productId: number, quantity: number) => void
  remove: (productId: number) => void
  syncProducts: (products: CartProduct[]) => void
  clear: () => void
}

const pick = (p: CartProduct): CartProduct => ({
  id: p.id, name: p.name, slug: p.slug, price: p.price, image_url: p.image_url, stock: p.stock,
})

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (product, quantity = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.product.id === product.id)
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.product.id === product.id
                  ? { ...i, quantity: Math.min(i.quantity + quantity, product.stock) }
                  : i,
              ),
            }
          }
          return { items: [...s.items, { product: pick(product), quantity: Math.min(quantity, product.stock) }] }
        }),
      setQuantity: (productId, quantity) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.product.id === productId ? { ...i, quantity: Math.max(1, Math.min(quantity, i.product.stock)) } : i,
          ),
        })),
      remove: (productId) => set((s) => ({ items: s.items.filter((i) => i.product.id !== productId) })),
      // Cập nhật giá / tồn kho mới nhất từ server
      syncProducts: (products) =>
        set((s) => ({
          items: s.items
            .map((i) => {
              const fresh = products.find((p) => p.id === i.product.id)
              return fresh ? { product: pick(fresh), quantity: Math.min(i.quantity, Math.max(fresh.stock, 1)) } : i
            }),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: 'bb-cart' },
  ),
)

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.quantity, 0)
export const cartSubtotal = (items: CartItem[]) => items.reduce((n, i) => n + i.quantity * i.product.price, 0)
