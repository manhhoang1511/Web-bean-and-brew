import { useEffect, useRef, useState } from 'react'
import { imageUrl } from '../api/client'

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Hiệu ứng "bay vào giỏ": nhân bản ảnh sản phẩm, bay theo đường cong tới icon giỏ hàng ([data-cart-icon]),
 * sau đó icon giỏ "nảy" lên. Dùng Web Animations API, không cần thư viện.
 */
export function flyToCart(sourceEl: HTMLElement | null | undefined, image: string) {
  const target = document.querySelector<HTMLElement>('[data-cart-icon]')
  if (!target) return
  const bump = () => {
    target.classList.remove('animate-bump')
    void target.offsetWidth // reset để chạy lại animation
    target.classList.add('animate-bump')
  }
  if (!sourceEl || prefersReducedMotion()) return bump()

  const from = sourceEl.getBoundingClientRect()
  const to = target.getBoundingClientRect()
  const size = 64
  const img = document.createElement('img')
  img.src = imageUrl(image)
  Object.assign(img.style, {
    position: 'fixed', zIndex: '100', width: `${size}px`, height: `${size}px`, borderRadius: '9999px',
    objectFit: 'cover', pointerEvents: 'none', boxShadow: '0 10px 30px rgb(0 0 0 / .25)',
    left: `${from.left + from.width / 2 - size / 2}px`, top: `${from.top + from.height / 2 - size / 2}px`,
  })
  document.body.appendChild(img)
  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  img.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 90}px) scale(.8)`, opacity: 1, offset: 0.5 }, // vòng cung
      { transform: `translate(${dx}px, ${dy}px) scale(.15)`, opacity: 0.6 },
    ],
    { duration: 750, easing: 'cubic-bezier(.5,0,.3,1)' },
  ).onfinish = () => {
    img.remove()
    bump()
  }
}

/** Trả về ref + cờ `visible` khi phần tử lọt vào màn hình (chỉ kích hoạt 1 lần) */
export function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) return setVisible(true)
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        io.disconnect()
      }
    }, { threshold, rootMargin: '0px 0px -40px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return { ref, visible }
}

/** Đếm số tăng dần từ 0 tới `to` khi xuất hiện trên màn hình */
export function useCountUp(to: number, visible: boolean, duration = 1400) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!visible) return
    if (prefersReducedMotion()) return setValue(to)
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setValue(to * (1 - Math.pow(1 - t, 3))) // ease-out cubic
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, visible, duration])
  return value
}
