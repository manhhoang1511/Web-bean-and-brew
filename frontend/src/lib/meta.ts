import { useEffect, useState } from 'react'
import { api } from '../api/client'

export interface Meta {
  grind_options: string[]
  shipping_fee: number
  free_shipping_threshold: number
}

const DEFAULT: Meta = {
  grind_options: ['Nguyên hạt', 'Xay phin', 'Xay pour-over', 'Xay espresso', 'Xay French press'],
  shipping_fee: 30_000,
  free_shipping_threshold: 500_000,
}

let cache: Promise<Meta> | null = null

/** Cấu hình dùng chung lấy từ backend (/api/meta), chỉ gọi 1 lần cho cả app */
export function useMeta(): Meta {
  const [meta, setMeta] = useState(DEFAULT)
  useEffect(() => {
    cache ??= api.get<Meta>('/api/meta').then((r) => r.data).catch(() => DEFAULT)
    cache.then(setMeta)
  }, [])
  return meta
}
