import { useEffect, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { prefersReducedMotion } from '../../lib/animations'
import { getLenis } from '../../lib/smoothScroll'

/** Màn hình chào lần đầu mở trang trong phiên: logo + ly cà phê đầy dần, rồi kéo màn lên */
export function Preloader() {
  const [state, setState] = useState<'show' | 'leave' | 'done'>(() => {
    try {
      return sessionStorage.getItem('bb-intro') || prefersReducedMotion() ? 'done' : 'show'
    } catch { return 'done' }
  })
  useEffect(() => {
    if (state !== 'show') return
    try { sessionStorage.setItem('bb-intro', '1') } catch { /* bỏ qua */ }
    const t1 = setTimeout(() => setState('leave'), 1500)
    const t2 = setTimeout(() => setState('done'), 2300)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [state])
  if (state === 'done') return null
  return (
    <div aria-hidden data-preloader className={`fixed inset-0 z-[300] flex flex-col items-center justify-center bg-espresso-900 transition-transform duration-700 ease-[cubic-bezier(.7,0,.3,1)] ${state === 'leave' ? '-translate-y-full' : ''}`}>
      {/* Ly cà phê đầy dần */}
      <div className="relative h-20 w-16">
        <div className="absolute inset-x-0 bottom-0 h-16 overflow-hidden rounded-b-[1.4rem] rounded-t-md border-[3px] border-latte-200">
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-caramel-600 to-caramel-400" style={{ animation: 'fill-cup 1.3s cubic-bezier(.5,0,.3,1) forwards' }} />
        </div>
        <div className="absolute -right-3 bottom-5 h-7 w-5 rounded-r-full border-[3px] border-l-0 border-latte-200" />
        {[0, 0.4, 0.8].map((d) => (
          <span key={d} className="absolute -top-6 h-6 w-1.5 rounded-full bg-white/40 blur-[1px] animate-steam" style={{ left: `${30 + d * 30}%`, animationDelay: `${d}s` }} />
        ))}
      </div>
      <p className="mt-6 font-display text-3xl font-bold text-latte-50">
        {'Bean & Brew'.split('').map((c, i) => (
          <span key={i} className="inline-block" style={{ animation: `letter-in .6s cubic-bezier(.2,.8,.2,1) ${0.2 + i * 0.05}s both` }}>{c === ' ' ? ' ' : c}</span>
        ))}
      </p>
      <p className="mt-2 text-xs uppercase tracking-[0.4em] text-latte-300" style={{ animation: 'slide-text .6s .8s both' }}>Rang mới mỗi tuần</p>
    </div>
  )
}

/** Con trỏ tùy biến: chấm nhỏ + vòng tròn đi theo có quán tính, phóng to khi rê lên link/nút */
export function CustomCursor() {
  const dot = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const [enabled] = useState(() => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches && !prefersReducedMotion())
  useEffect(() => {
    if (!enabled) return
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, raf = 0, hover = false, down = false
    const onMove = (e: PointerEvent) => {
      x = e.clientX; y = e.clientY
      hover = !!(e.target as HTMLElement).closest('a, button, [role="button"], input, select, textarea, label')
    }
    const onDown = () => { down = true }
    const onUp = () => { down = false }
    const loop = () => {
      rx += (x - rx) * 0.18
      ry += (y - ry) * 0.18
      if (dot.current) dot.current.style.transform = `translate(${x}px, ${y}px)`
      if (ring.current) ring.current.style.transform = `translate(${rx}px, ${ry}px) scale(${down ? 0.8 : hover ? 1.8 : 1})`
      raf = requestAnimationFrame(loop)
    }
    const onLeave = () => { dot.current?.style.setProperty('opacity', '0'); ring.current?.style.setProperty('opacity', '0') }
    const onEnter = () => { dot.current?.style.setProperty('opacity', '1'); ring.current?.style.setProperty('opacity', '1') }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    document.documentElement.addEventListener('pointerleave', onLeave)
    document.documentElement.addEventListener('pointerenter', onEnter)
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      document.documentElement.removeEventListener('pointerenter', onEnter)
    }
  }, [enabled])
  if (!enabled) return null
  return (
    <>
      <div ref={dot} aria-hidden className="pointer-events-none fixed left-0 top-0 z-[250] -ml-1 -mt-1 h-2 w-2 rounded-full bg-caramel-500" />
      <div ref={ring} aria-hidden className="pointer-events-none fixed left-0 top-0 z-[250] -ml-5 -mt-5 h-10 w-10 rounded-full border-2 border-caramel-500/60 transition-[transform_.15s_ease-out,opacity_.2s] mix-blend-difference" />
    </>
  )
}

/** Gợn sóng lan ra từ điểm bấm trên mọi nút .btn* */
export function useRipple() {
  useEffect(() => {
    if (prefersReducedMotion()) return
    const onDown = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.btn, .btn-primary, .btn-accent, .btn-outline, .btn-danger, .btn-ghost')
      if (!el || (el as HTMLButtonElement).disabled) return
      const r = el.getBoundingClientRect()
      const size = Math.max(r.width, r.height) * 2
      const span = document.createElement('span')
      span.className = 'ripple'
      Object.assign(span.style, { width: `${size}px`, height: `${size}px`, left: `${e.clientX - r.left - size / 2}px`, top: `${e.clientY - r.top - size / 2}px` })
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
      el.style.overflow = 'hidden'
      el.appendChild(span)
      span.addEventListener('animationend', () => span.remove())
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])
}

/** Nút về đầu trang, có vòng tròn thể hiện % đã cuộn */
export function BackToTop() {
  const [p, setP] = useState(0)
  useEffect(() => {
    const on = () => {
      const max = document.documentElement.scrollHeight - innerHeight
      setP(max > 0 ? scrollY / max : 0)
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  const C = 2 * Math.PI * 20
  const show = p > 0.12
  return (
    <button onClick={() => { const l = getLenis(); if (l) l.scrollTo(0); else window.scrollTo({ top: 0, behavior: 'smooth' }) }} aria-label="Về đầu trang"
      className={`fixed bottom-24 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-coffee-800 shadow-lg transition duration-500 hover:-translate-y-1 hover:text-caramel-600 ${show ? 'opacity-100' : 'pointer-events-none translate-y-6 opacity-0'}`}>
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48" aria-hidden>
        <circle cx="24" cy="24" r="20" fill="none" stroke="var(--color-coffee-100)" strokeWidth="3" />
        <circle cx="24" cy="24" r="20" fill="none" stroke="var(--color-caramel-500)" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - p)} />
      </svg>
      <ArrowUp size={18} className="relative" />
    </button>
  )
}
