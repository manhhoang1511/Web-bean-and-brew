import { create } from 'zustand'
import toast from 'react-hot-toast'
import { api, errorMessage } from '../api/client'
import { useAuth } from './auth'

interface WishlistState {
  ids: number[]
  load: () => Promise<void>
  toggle: (productId: number, name?: string) => Promise<void>
  reset: () => void
}

/** Wishlist lưu ở server (theo tài khoản); store chỉ giữ danh sách id để tô trái tim. */
export const useWishlist = create<WishlistState>()((set, get) => ({
  ids: [],
  load: async () => {
    const { data } = await api.get<number[]>('/api/wishlist/ids')
    set({ ids: data })
  },
  toggle: async (productId, name) => {
    if (!useAuth.getState().token) {
      toast('Đăng nhập để lưu sản phẩm yêu thích', { icon: '🤍' })
      return
    }
    const liked = get().ids.includes(productId)
    // Cập nhật giao diện trước (optimistic), lỗi thì hoàn tác
    set({ ids: liked ? get().ids.filter((i) => i !== productId) : [...get().ids, productId] })
    try {
      if (liked) await api.delete(`/api/wishlist/${productId}`)
      else await api.post(`/api/wishlist/${productId}`)
      if (!liked) toast.success(name ? `Đã thêm ${name} vào yêu thích` : 'Đã thêm vào yêu thích', { id: `wl-${productId}` })
    } catch (err) {
      set({ ids: liked ? [...get().ids, productId] : get().ids.filter((i) => i !== productId) })
      toast.error(errorMessage(err))
    }
  },
  reset: () => set({ ids: [] }),
}))
