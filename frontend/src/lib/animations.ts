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

/**
 * Parallax theo chuột + cuộn trang: ghi biến CSS --mx, --my (-1..1) và --sy (px đã cuộn) lên phần tử.
 * Ghi thẳng vào style (không setState) nên không re-render React, mượt 60fps.
 */
export function useParallax<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    let raf = 0
    let mx = 0, my = 0, tx = 0, ty = 0
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      tx = ((e.clientX - r.left) / r.width) * 2 - 1
      ty = ((e.clientY - r.top) / r.height) * 2 - 1
    }
    const onLeave = () => { tx = 0; ty = 0 }
    const loop = () => {
      mx += (tx - mx) * 0.08 // nội suy -> chuyển động có quán tính
      my += (ty - my) * 0.08
      el.style.setProperty('--mx', mx.toFixed(4))
      el.style.setProperty('--my', my.toFixed(4))
      el.style.setProperty('--sy', `${Math.min(window.scrollY, 1200)}px`)
      raf = requestAnimationFrame(loop)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [])
  return ref
}

/** Nghiêng 3D theo vị trí chuột (cho thẻ sản phẩm). Ghi --rx, --ry, --gx, --gy (vị trí vệt sáng). */
export function useTilt<T extends HTMLElement>(max = 7) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion() || !window.matchMedia('(hover: hover)').matches) return
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height
      el.style.setProperty('--rx', `${(0.5 - py) * max}deg`)
      el.style.setProperty('--ry', `${(px - 0.5) * max}deg`)
      el.style.setProperty('--gx', `${px * 100}%`)
      el.style.setProperty('--gy', `${py * 100}%`)
    }
    const onLeave = () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg') }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => { el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerleave', onLeave) }
  }, [max])
  return ref
}

/** Nút "nam châm": hút nhẹ theo con trỏ khi rê gần */
export function useMagnetic<T extends HTMLElement>(strength = 0.3) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion() || !window.matchMedia('(hover: hover)').matches) return
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2)
      el.style.transform = `translate(${x * strength}px, ${y * strength}px)`
    }
    const onLeave = () => { el.style.transform = '' }
    el.style.transition = 'transform .35s cubic-bezier(.2,.8,.2,1)'
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => { el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerleave', onLeave) }
  }, [strength])
  return ref
}

/**
 * Tiến độ cuộn của phần tử -> biến CSS --p (0..1), không re-render.
 * mode 'enter': 0 khi mép trên vừa chạm đáy màn hình, 1 khi mép trên chạm đỉnh (dùng cho phóng to video).
 * mode 'through': 0 khi phần tử bắt đầu ghim, 1 khi cuộn hết chiều cao (dùng cho cuộn ngang ghim).
 */
export function useScrollProgress<T extends HTMLElement>(mode: 'enter' | 'through' = 'enter', onProgress?: (p: number) => void) {
  const ref = useRef<T>(null)
  const cb = useRef(onProgress)
  cb.current = onProgress
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const update = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      const p = mode === 'enter'
        ? (vh - r.top) / vh
        : -r.top / Math.max(1, r.height - vh)
      const clamped = Math.min(1, Math.max(0, p))
      el.style.setProperty('--p', clamped.toFixed(4))
      cb.current?.(clamped)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [mode])
  return ref
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
