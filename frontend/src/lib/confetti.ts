import { prefersReducedMotion } from './animations'

const COLORS = ['#d08a3c', '#e0a35c', '#6f4630', '#f8f3ea', '#fb7185', '#34d399', '#fbbf24']

/** Pháo giấy bằng <canvas>, không cần thư viện. Tự dọn sau khoảng 3 giây. */
export function fireConfetti(count = 160) {
  if (prefersReducedMotion()) return
  const canvas = document.createElement('canvas')
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '200' })
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')!
  const dpr = window.devicePixelRatio || 1
  canvas.width = innerWidth * dpr
  canvas.height = innerHeight * dpr
  ctx.scale(dpr, dpr)

  // Bắn từ 2 góc dưới lên giữa
  const parts = Array.from({ length: count }, (_, i) => {
    const left = i % 2 === 0
    return {
      x: left ? innerWidth * 0.1 : innerWidth * 0.9, y: innerHeight * 0.95,
      vx: (left ? 1 : -1) * (4 + Math.random() * 7), vy: -(11 + Math.random() * 9),
      w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      color: COLORS[i % COLORS.length], round: Math.random() < 0.3,
    }
  })
  const start = performance.now()
  const frame = (now: number) => {
    const t = now - start
    ctx.clearRect(0, 0, innerWidth, innerHeight)
    for (const p of parts) {
      p.vy += 0.32 // trọng lực
      p.vx *= 0.99 // lực cản không khí
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      ctx.save()
      ctx.globalAlpha = Math.max(0, 1 - t / 3000)
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill() }
      else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)) + 2) // lật giấy
      ctx.restore()
    }
    if (t < 3000) requestAnimationFrame(frame)
    else canvas.remove()
  }
  requestAnimationFrame(frame)
}
