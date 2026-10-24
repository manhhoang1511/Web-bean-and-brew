import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartTopping, Product, Variant } from '../api/types'

/** Chỉ lưu thông tin tối thiểu; giá cuối cùng luôn do server tính khi đặt hàng. */
export type CartProduct = Pick<Product, 'id' | 'name' | 'slug' | 'price' | 'image_url' | 'stock'>

/** Mọi tùy chọn của 1 dòng: phân loại (khối lượng/size), kiểu xay, đá, đường, topping */
export interface LineOptions {
  variant?: Variant | null
  grind?: string | null
  sugar?: string | null
  ice?: string | null
  toppings?: CartTopping[]
}

export interface CartItem {
  key: string // sản phẩm + mọi tùy chọn -> 2 ly khác đường/đá là 2 dòng riêng
  product: CartProduct
  variant: Variant | null
  grind: string | null
  sugar: string | null
  ice: string | null
  toppings: CartTopping[]
  quantity: number
}

interface CartState {
  items: CartItem[]
  add: (product: CartProduct, quantity?: number, options?: LineOptions) => void
  setQuantity: (key: string, quantity: number) => void
  remove: (key: string) => void
  syncProducts: (products: Product[]) => void
  clear: () => void
}

export const itemKey = (productId: number, o: LineOptions = {}) =>
  [productId, o.variant?.id ?? 0, o.grind ?? '', o.sugar ?? '', o.ice ?? '',
    [...(o.toppings ?? [])].sort((a, b) => a.id - b.id).map((t) => `${t.id}x${t.quantity}`).join('+')].join('|')

export const toppingsTotal = (toppings: CartTopping[] = []) => toppings.reduce((n, t) => n + t.price * t.quantity, 0)

/** Giá 1 đơn vị: giá phân loại (hoặc sản phẩm) + topping */
export const unitPrice = (i: CartItem) => (i.variant?.price ?? i.product.price) + toppingsTotal(i.toppings)
export const lineStock = (i: CartItem) => i.variant?.stock ?? i.product.stock

/** Nhãn tùy chọn: "M · Ít đá · 50% đường · +2 Trân châu đen" (cùng định dạng với backend) */
export const optionsLabel = (o: LineOptions) =>
  [o.variant?.label, o.grind, o.ice, o.sugar && `${o.sugar} đường`, ...(o.toppings ?? []).map((t) => `+${t.quantity} ${t.name}`)]
    .filter(Boolean).join(' · ')
export const lineLabel = (i: CartItem) => optionsLabel(i)

const pick = (p: CartProduct): CartProduct => ({
  id: p.id, name: p.name, slug: p.slug, price: p.price, image_url: p.image_url, stock: p.stock,
})

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (product, quantity = 1, o = {}) =>
        set((s) => {
          const key = itemKey(product.id, o)
          const max = o.variant?.stock ?? product.stock
          const existing = s.items.find((i) => i.key === key)
          if (existing) {
            return { items: s.items.map((i) => (i.key === key ? { ...i, quantity: Math.min(i.quantity + quantity, max) } : i)) }
          }
          const item: CartItem = {
            key, product: pick(product), variant: o.variant ?? null, grind: o.grind ?? null,
            sugar: o.sugar ?? null, ice: o.ice ?? null, toppings: o.toppings ?? [], quantity: Math.min(quantity, max),
          }
          return { items: [...s.items, item] }
        }),
      setQuantity: (key, quantity) =>
        set((s) => ({
          items: s.items.map((i) => (i.key === key ? { ...i, quantity: Math.max(1, Math.min(quantity, lineStock(i))) } : i)),
        })),
      remove: (key) => set((s) => ({ items: s.items.filter((i) => i.key !== key) })),
      // Cập nhật giá / tồn kho mới nhất từ server; bỏ dòng có phân loại đã bị xóa
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
      version: 3,
      migrate: () => ({ items: [] }), // giỏ hàng định dạng cũ -> làm trống
    },
  ),
)

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.quantity, 0)
export const cartSubtotal = (items: CartItem[]) => items.reduce((n, i) => n + i.quantity * unitPrice(i), 0)

/** Dữ liệu gửi lên API đặt hàng / chatbot */
export const toOrderLine = (i: CartItem) => ({
  product_id: i.product.id, variant_id: i.variant?.id ?? null, grind: i.grind, sugar: i.sugar, ice: i.ice,
  toppings: i.toppings.map((t) => ({ topping_id: t.id, quantity: t.quantity })), quantity: i.quantity,
})
