import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { prefersReducedMotion, useMagnetic, useScrollProgress } from '../../lib/animations'
import type { CoffeeScene } from '../three/CoffeeScene'

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1497515114629-f71d768fd07c?w=1600&q=80&auto=format&fit=crop'

/** Màu nền cho từng chương (nội suy theo tiến độ cuộn) – kiểu Dogstudio */
const BG = [[18, 13, 10], [84, 47, 22], [14, 20, 24]]
const mixColor = (p: number) => {
  const seg = Math.min(BG.length - 2, Math.floor(p * (BG.length - 1)))
  const t = p * (BG.length - 1) - seg
  const c = BG[seg].map((v, i) => Math.round(v + (BG[seg + 1][i] - v) * t))
  return `rgb(${c.join(',')})`
}

const CHAPTERS = [
  { kicker: 'Bean & Brew — Since 2024', lines: [['Cà phê rang'], [<em key="e">thủ công</em>], ['cho người tinh tế.']],
    caption: 'Cuộn chậm để bắt đầu hành trình của một tách cà phê.' },
  { kicker: 'Chương 02 — Chọn hạt', lines: [['Từng hạt'], ['được chọn'], [<em key="e">bằng tay.</em>]],
    caption: 'Arabica Cầu Đất · Robusta Buôn Ma Thuột · Ethiopia Yirgacheffe · rang mới mỗi thứ Hai.' },
  { kicker: 'Chương 03 — Thưởng thức', lines: [['Một tách.'], [<em key="e">Đúng gu</em>, ' bạn.']],
    caption: 'Size, đá, đường, topping – do chính bạn chọn. Trợ lý AI Bean luôn sẵn sàng tư vấn.' },
]

export default function Immersive3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<CoffeeScene | null>(null)
  const [chapter, setChapter] = useState(0)
  const [failed, setFailed] = useState(false)
  const ctaRef = useMagnetic<HTMLAnchorElement>(0.3)

  const sectionRef = useScrollProgress<HTMLElement>('through', (p) => {
    const bg = mixColor(p)
    sceneRef.current?.setProgress(p)
    sceneRef.current?.setBackground(bg)
    if (stageRef.current) stageRef.current.style.backgroundColor = bg
    setChapter(p < 0.3 ? 0 : p < 0.66 ? 1 : 2)
  })

  // Nạp three.js theo nhu cầu (code-splitting), chỉ chạy vòng render khi section đang hiện
  useEffect(() => {
    let disposed = false
    let io: IntersectionObserver | undefined
    let ro: ResizeObserver | undefined
    const canvas = canvasRef.current!
    import('../three/CoffeeScene').then(({ CoffeeScene }) => {
      if (disposed) return
      let scene: CoffeeScene
      try {
        scene = new CoffeeScene(canvas)
      } catch {
        setFailed(true) // máy không hỗ trợ WebGL -> ảnh tĩnh
        return
      }
      sceneRef.current = scene
      const reduced = prefersReducedMotion()
      io = new IntersectionObserver(([e]) => (e.isIntersecting && !reduced ? scene.start() : scene.stop()))
      io.observe(canvas)
      ro = new ResizeObserver(() => scene.resize())
      ro.observe(canvas.parentElement!)
    }).catch(() => setFailed(true))

    const onMove = (e: PointerEvent) => sceneRef.current?.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1)
    window.addEventListener('pointermove', onMove)
    return () => {
      disposed = true
      io?.disconnect()
      ro?.disconnect()
      window.removeEventListener('pointermove', onMove)
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
  }, [])

  return (
    <section ref={sectionRef} data-overlay-header className="relative h-[320vh]">
      <div ref={stageRef} className="sticky top-0 h-screen overflow-hidden text-latte-50" style={{ backgroundColor: mixColor(0) }}>
        {/* Quầng sáng caramel phía sau tách */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[70vh] w-[70vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-caramel-500/20 blur-[120px] lg:left-[62%]" />
        {failed
          ? <img src={FALLBACK_IMG} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
          : <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="Tách cà phê 3D" role="img" />}
        <div className="grain pointer-events-none absolute inset-0" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30 sm:from-black/50 sm:via-transparent" />
        {/* Làm tối phía có chữ để luôn đọc rõ */}
        <div className={`pointer-events-none absolute inset-0 transition-opacity duration-700 bg-gradient-to-r from-black/55 via-black/10 to-transparent ${chapter === 1 ? 'opacity-0' : 'opacity-100'}`} />
        <div className={`pointer-events-none absolute inset-0 transition-opacity duration-700 bg-gradient-to-l from-black/55 via-black/10 to-transparent ${chapter === 1 ? 'opacity-100' : 'opacity-0'}`} />

        {/* Chữ kiểu tạp chí: mỗi chương thay toàn bộ, từng dòng trượt lên */}
        <div className="pointer-events-none absolute inset-0 flex items-end pb-28 sm:items-center sm:pb-0">
          <div className="container-page">
            {/* Chữ luôn nằm phía đối diện tách: trái -> phải -> trái */}
            <div key={chapter} className={`sm:w-fit ${chapter === 1 ? 'lg:ml-auto lg:text-right' : ''}`}>
              <p className="editorial-line text-xs font-semibold uppercase tracking-[0.35em] text-caramel-400" style={{ '--l': 0 } as CSSProperties}>
                {CHAPTERS[chapter].kicker}
              </p>
              {/* Cỡ chữ co giãn theo bề rộng màn hình; mỗi dòng không tự xuống hàng (giữ cụm "thủ công" liền nhau) */}
              <h1 className="mt-5 font-display text-[clamp(2.9rem,5.2vw,7.5rem)] font-semibold leading-[0.95] tracking-tight [text-shadow:0_4px_30px_rgb(0_0_0/.45)]">
                {CHAPTERS[chapter].lines.map((line, i) => (
                  <span key={i} className="block overflow-hidden pb-[0.12em]">
                    <span className="editorial-line block sm:whitespace-nowrap [&_em]:font-normal [&_em]:italic [&_em]:text-caramel-400" style={{ '--l': i + 1 } as CSSProperties}>{line}</span>
                  </span>
                ))}
              </h1>
              <p className={`editorial-line mt-6 max-w-md text-sm leading-relaxed text-latte-200 sm:text-base ${chapter === 1 ? 'lg:ml-auto' : ''}`}
                style={{ '--l': CHAPTERS[chapter].lines.length + 1 } as CSSProperties}>
                {CHAPTERS[chapter].caption}
              </p>
              {chapter === 2 && (
                <div className="editorial-line pointer-events-auto mt-8 flex flex-wrap gap-3" style={{ '--l': 5 } as CSSProperties}>
                  <Link ref={ctaRef} to="/shop" className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-semibold text-espresso-900 transition-colors hover:bg-caramel-400">
                    Vào cửa hàng <ArrowUpRight size={18} />
                  </Link>
                  <Link to="/shop?category=do-uong-pha-che" className="inline-flex items-center gap-2 rounded-full border border-white/30 px-7 py-3.5 font-semibold backdrop-blur transition hover:bg-white/10">
                    🥤 Gọi đồ uống
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bộ đếm chương + thanh tiến độ dọc (kiểu Dogstudio) */}
        <div className="absolute bottom-8 left-6 flex items-end gap-4 sm:left-10" aria-hidden>
          <span className="font-display text-sm tabular-nums text-latte-200">
            <span className="text-4xl text-latte-50">{String(chapter + 1).padStart(2, '0')}</span> / 03
          </span>
          <span className="relative h-28 w-px bg-white/20">
            <span className="absolute inset-x-0 top-0 bg-caramel-400" style={{ height: 'calc(var(--p, 0) * 100%)' }} />
          </span>
        </div>
        <div className={`absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-xs uppercase tracking-[0.3em] text-latte-300 transition-opacity duration-500 ${chapter === 0 ? 'opacity-100' : 'opacity-0'}`}>
          Cuộn <ArrowDown size={14} className="animate-bounce" />
        </div>
      </div>
    </section>
  )
}
