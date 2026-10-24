import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Topping } from '../api/types'

export interface Meta {
  grind_options: string[]
  sugar_options: string[]
  ice_options: string[]
  default_sugar: string
  default_ice: string
  max_topping_qty: number
  max_toppings_total: number
  toppings: Topping[]
  shipping_fee: number
  free_shipping_threshold: number
}

export const DEFAULT_META: Meta = {
  grind_options: ['Nguyên hạt', 'Xay phin', 'Xay pour-over', 'Xay espresso', 'Xay French press'],
  sugar_options: ['0%', '30%', '50%', '70%', '100%'],
  ice_options: ['Nóng', 'Không đá', 'Ít đá', 'Vừa đá', 'Nhiều đá'],
  default_sugar: '100%',
  default_ice: 'Vừa đá',
  max_topping_qty: 3,
  max_toppings_total: 5,
  toppings: [],
  shipping_fee: 30_000,
  free_shipping_threshold: 500_000,
}

let cache: Promise<Meta> | null = null

export const loadMeta = () => (cache ??= api.get<Meta>('/api/meta').then((r) => r.data).catch(() => DEFAULT_META))

/** Cấu hình dùng chung lấy từ backend (/api/meta), chỉ gọi 1 lần cho cả app */
export function useMeta(): Meta {
  const [meta, setMeta] = useState(DEFAULT_META)
  useEffect(() => {
    loadMeta().then(setMeta)
  }, [])
  return meta
}
