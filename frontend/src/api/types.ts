// Kiểu dữ liệu khớp với Pydantic schemas ở backend (app/schemas.py)

export interface User {
  id: number
  email: string
  full_name: string
  phone: string | null
  address: string | null
  role: 'customer' | 'admin'
  created_at: string
}

export interface Category {
  id: number
  name: string
  slug: string
  description: string | null
  icon: string | null
  product_count?: number
}

export interface Variant {
  id: number
  label: string
  price: number
  original_price: number | null
  stock: number
}

export interface Product {
  has_grind_option: boolean
  variants: Variant[]
  id: number
  name: string
  slug: string
  description: string
  price: number
  original_price: number | null
  stock: number
  in_stock: boolean
  image_url: string
  gallery: string[]
  origin: string | null
  roast_level: string | null
  weight: string | null
  is_featured: boolean
  is_active: boolean
  sold_count: number
  rating_avg: number
  rating_count: number
  category: Category | null
  created_at: string
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface Review {
  id: number
  rating: number
  comment: string
  created_at: string
  user: { id: number; full_name: string }
  verified_purchase: boolean
}

export type OrderStatus = 'pending' | 'shipping' | 'completed' | 'cancelled'
export type PaymentMethod = 'cod' | 'card' | 'qr'

export interface OrderItem {
  id: number
  product_id: number | null
  variant_id: number | null
  variant_label: string | null
  product_name: string
  product_image: string
  unit_price: number
  quantity: number
  line_total: number
}

export interface Order {
  id: number
  code: string
  status: OrderStatus
  payment_method: PaymentMethod
  payment_status: 'unpaid' | 'paid' | 'refunded'
  shipping_name: string
  shipping_phone: string
  shipping_address: string
  note: string | null
  subtotal: number
  discount: number
  shipping_fee: number
  total: number
  coupon_code: string | null
  created_at: string
  updated_at: string
  items: OrderItem[]
  user?: { id: number; email: string; full_name: string }
}

export interface Coupon {
  id: number
  code: string
  description: string
  discount_percent: number
  max_discount: number | null
  min_order: number
  is_active: boolean
}

export interface Stats {
  total_revenue: number
  total_orders: number
  total_customers: number
  total_products: number
  revenue_today: number
  orders_today: number
  average_order_value: number
  orders_by_status: Record<OrderStatus, number>
  revenue_by_day: { date: string; revenue: number; orders: number }[]
  top_products: { id: number; name: string; image_url: string; sold: number; revenue: number }[]
  low_stock: Product[]
  recent_orders: Order[]
}

export interface Customer extends User {
  order_count: number
  total_spent: number
}

export interface ChatAction {
  type: 'add_to_cart'
  product: Product
  variant_id: number | null
  grind: string | null
  quantity: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  products?: Product[]
  added?: ChatAction[] // sản phẩm chatbot đã thêm vào giỏ trong lượt trả lời này
}
