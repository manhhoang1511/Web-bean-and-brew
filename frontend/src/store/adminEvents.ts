import { create } from 'zustand'

export interface AdminEvent {
  type: 'new_order' | 'order_paid' | 'order_cancelled'
  code: string
  total: number
  customer?: string
  items?: number
}

interface AdminEventsState {
  version: number // tăng mỗi khi có sự kiện -> các trang admin tự tải lại dữ liệu
  connected: boolean
  recent: (AdminEvent & { at: number })[]
  push: (ev: AdminEvent) => void
  setConnected: (v: boolean) => void
}

export const useAdminEvents = create<AdminEventsState>()((set) => ({
  version: 0,
  connected: false,
  recent: [],
  push: (ev) => set((s) => ({ version: s.version + 1, recent: [{ ...ev, at: Date.now() }, ...s.recent].slice(0, 20) })),
  setConnected: (connected) => set({ connected }),
}))
