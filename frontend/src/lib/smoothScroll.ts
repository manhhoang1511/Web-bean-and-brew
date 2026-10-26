import { useEffect } from 'react'
import type Lenis from 'lenis'
import { prefersReducedMotion } from './animations'

/** Lenis đang chạy (nếu có) – để popup có thể tạm dừng cuộn mượt, nút "về đầu trang" dùng scrollTo mượt */
let current: Lenis | null = null
export const getLenis = () => current

/**
 * Cuộn mượt có quán tính (kiểu Aristide Benoist / Dogstudio) – chỉ bật ở trang giới thiệu.
 * Lenis vẫn cuộn chính window nên mọi hook dùng sự kiện 'scroll' hoạt động bình thường.
 */
export function useSmoothScroll(enabled = true) {
  useEffect(() => {
    if (!enabled || prefersReducedMotion() || !window.matchMedia('(pointer: fine)').matches) return
    let raf = 0
    let lenis: Lenis | null = null
    let cancelled = false
    import('lenis').then(({ default: LenisCtor }) => {
      if (cancelled) return
      lenis = new LenisCtor({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true })
      current = lenis
      const loop = (time: number) => {
        lenis!.raf(time)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      lenis?.destroy()
      if (current === lenis) current = null
    }
  }, [enabled])
}
