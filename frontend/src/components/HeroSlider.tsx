import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCountUp, useInView, useMagnetic, useParallax } from '../lib/animations'
import { photo } from '../lib/media'

const IMG = (id: string, _w?: number) => photo(id) // ảnh đã tải sẵn về máy (chạy không cần mạng)
const DURATION = 6500 // ms mỗi cảnh

/**
 * focus: vùng chứa vật thể chính (ly cà phê...) -> lớp ảnh phía trước chỉ hiện vùng này,
 * tạo cảm giác vật thể đứng TRƯỚC chữ khổng lồ (giả lập ảnh tách nền bằng CSS mask).
 */
const SLIDES = [
  { word: 'CÀ PHÊ', img: '1497515114629-f71d768fd07c', focus: '26% 68%', size: '30% 32%', top: '22%',
    title: 'Rang mới mỗi tuần', desc: 'Arabica Cầu Đất, Robusta Buôn Ma Thuột – rang thủ công, giao tận nhà trong 48 giờ.',
    cta: 'Mua cà phê hạt', to: '/shop?category=ca-phe-hat' },
  { word: 'MATCHA', img: '1515823064-d6e0c04616a7', focus: '50% 70%', size: '42% 30%', top: '13%',
    title: 'Matcha Uji Nhật Bản', desc: 'Đánh tay cùng sữa tươi – thanh, chát nhẹ, hậu ngọt. Chọn size, đá và đường theo gu.',
    cta: 'Gọi Matcha Latte', to: '/products/matcha-latte' },
  { word: 'TRÀ SỮA', img: '1558857563-b371033873b8', focus: '48% 72%', size: '22% 46%', top: '14%',
    title: 'Trân châu nấu mỗi sáng', desc: 'Trà đen đậm vị, sữa tươi, trân châu đường đen dẻo thơm. Thêm topping tùy thích.',
    cta: 'Xem menu đồ uống', to: '/shop?category=do-uong-pha-che' },
  { word: 'PHA CHẾ', img: '1442512595331-e89e73853f31', focus: '55% 55%', size: '30% 48%', top: '14%',
    title: 'Pour-over tại nhà', desc: 'Phễu V60, bình Chemex, máy xay – đủ dụng cụ để bạn tự tay pha ly cà phê hoàn hảo.',
    cta: 'Dụng cụ pha chế', to: '/shop?category=dung-cu-pha-che' },
]

function Stat({ to, suffix, label, decimals = 0 }: { to: number; suffix: string; label: string; decimals?: number }) {
  const { ref, visible } = useInView<HTMLDivElement>(0.3)
  const v = useCountUp(to, visible, 1800)
  return (
    <div ref={ref}>
      <p className="text-3xl font-bold tracking-tight text-white sm:text-5xl">{v.toFixed(decimals).replace('.', ',')}{suffix}</p>
      <p className="mt-1 text-xs text-white/70 sm:text-sm">{label}</p>
    </div>
  )
}

/** Chữ khổng lồ: mỗi ký tự trượt lên lần lượt khi đổi cảnh */
function GiantWord({ word }: { word: string }) {
  return (
    <h1 key={word} aria-label={word}
      className="giant-word select-none whitespace-nowrap text-center font-extrabold leading-[0.85] tracking-[-0.04em]">
      {[...word].map((ch, i) => (
        <span key={i} className="split-mask" aria-hidden>
          <span className="split-letter" style={{ '--i': i } as CSSProperties}>{ch === ' ' ? ' ' : ch}</span>
        </span>
      ))}
    </h1>
  )
}

export default function HeroSlider() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const parallaxRef = useParallax<HTMLDivElement>()
  const ctaRef = useMagnetic<HTMLAnchorElement>(0.25)
  const arrowRef = useMagnetic<HTMLAnchorElement>(0.45)
  const slide = SLIDES[index]
  const next = SLIDES[(index + 1) % SLIDES.length]

  const go = useCallback((i: number) => setIndex((i + SLIDES.length) % SLIDES.length), [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(index + 1)
      if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, go])

  // Lớp ảnh (nền và lớp trước dùng chung để luôn khớp nhau khi parallax)
  const Layers = ({ front }: { front?: boolean }) => (
    <>
      {SLIDES.map((s, i) => (
        <div key={s.img} aria-hidden
          className={`hero-img absolute inset-[-6%] transition-[opacity,transform] duration-[1400ms] ease-out ${i === index ? 'opacity-100 scale-100' : 'opacity-0 scale-110'}`}
          style={front ? {
            WebkitMaskImage: `radial-gradient(ellipse ${s.size} at ${s.focus}, #000 55%, transparent 100%)`,
            maskImage: `radial-gradient(ellipse ${s.size} at ${s.focus}, #000 55%, transparent 100%)`,
          } : undefined}>
          <img src={IMG(s.img)} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/15 to-black/75" />
        </div>
      ))}
    </>
  )

  return (
    <section className="px-2 pt-2 sm:px-3 sm:pt-3">
      <div ref={parallaxRef} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
        className="hero-stage relative isolate h-[min(92vh,860px)] min-h-[600px] overflow-hidden rounded-[1.75rem] bg-espresso-900 sm:rounded-[2.25rem]">
        {/* 1. Ảnh nền */}
        <div className="parallax-bg absolute inset-0"><Layers /></div>

        {/* 2. Chữ khổng lồ (nằm giữa 2 lớp ảnh) */}
        <div className="parallax-word pointer-events-none absolute inset-x-0 z-10 flex justify-center px-4 transition-[top] duration-1000 ease-out"
          style={{ top: slide.top }}>
          <GiantWord word={slide.word} />
        </div>

        {/* 3. Lớp ảnh phía trước chỉ lộ vật thể chính -> vật thể "đè" lên chữ */}
        <div className="parallax-bg pointer-events-none absolute inset-0 z-20"><Layers front /></div>

        {/* Hạt cà phê trang trí bay theo chuột (lớp gần nhất -> di chuyển nhiều nhất) */}
        <div className="parallax-near pointer-events-none absolute inset-0 z-20" aria-hidden>
          {[['12%', '22%', 40, 0], ['84%', '30%', 28, -2], ['76%', '58%', 20, -4], ['20%', '64%', 24, -1]].map(([l, t, s, d]) => (
            <svg key={String(l)} viewBox="0 0 64 64" className="absolute animate-float opacity-70"
              style={{ left: l as string, top: t as string, width: s as number, height: s as number, animationDelay: `${d}s` }}>
              <ellipse cx="32" cy="32" rx="14" ry="20" fill="#d08a3c" transform="rotate(30 32 32)" />
              <path d="M25 16c9 7 5 25 14 32" stroke="#3b2a20" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
          ))}
        </div>

        {/* 4. Nội dung */}
        <div className="absolute inset-x-0 bottom-0 z-30 p-5 sm:p-8 lg:p-12">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="hero-in flex gap-8 sm:gap-14" style={{ '--d': '300ms' } as CSSProperties}>
                <Stat to={20} suffix="K+" label="Ly cà phê mỗi tháng" />
                <Stat to={63} suffix="+" label="Món & sản phẩm" />
                <Stat to={4.8} suffix="★" label="Đánh giá trung bình" decimals={1} />
              </div>
              <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="hero-in flex shrink-0 items-center gap-1.5" style={{ '--d': '450ms' } as CSSProperties}>
                  <Link ref={ctaRef} to={slide.to}
                    className="shine rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-espresso-900 shadow-lg transition-colors hover:bg-caramel-400">
                    {slide.cta}
                  </Link>
                  <Link ref={arrowRef} to={slide.to} aria-label={slide.cta}
                    className="group flex h-12 w-12 items-center justify-center rounded-full bg-white text-espresso-900 shadow-lg transition-colors hover:bg-caramel-500 hover:text-white">
                    <ArrowUpRight size={20} className="transition duration-300 group-hover:rotate-45" />
                  </Link>
                </div>
                <div key={slide.word} className="text-white">
                  <p className="slide-text text-sm font-semibold text-caramel-400">{slide.title}</p>
                  <p className="slide-text max-w-sm text-sm leading-relaxed text-white/80" style={{ animationDelay: '.12s' }}>{slide.desc}</p>
                </div>
              </div>
            </div>

            {/* Thẻ xem trước cảnh tiếp theo + tiến trình */}
            <div className="hero-in hidden w-72 shrink-0 rounded-3xl border border-white/15 bg-white/10 p-2.5 backdrop-blur-xl lg:block"
              style={{ '--d': '600ms' } as CSSProperties}>
              <button onClick={() => go(index + 1)} className="group relative block aspect-[16/10] w-full overflow-hidden rounded-2xl" aria-label="Cảnh tiếp theo">
                <img key={next.img} src={IMG(next.img, 600)} alt="" className="h-full w-full object-cover transition duration-700 animate-fade-in group-hover:scale-110" />
                <span className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-3 text-left text-sm font-semibold text-white">
                  Tiếp theo: {next.word}
                </span>
              </button>
              <div className="flex items-center gap-3 px-1.5 pb-1 pt-3 text-white">
                <span className="text-xs font-medium tabular-nums">{String(index + 1).padStart(2, '0')}/{String(SLIDES.length).padStart(2, '0')}</span>
                <div className="flex flex-1 gap-1.5">
                  {SLIDES.map((s, i) => (
                    <button key={s.word} onClick={() => go(i)} aria-label={`Cảnh ${i + 1}`} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
                      {i === index ? (
                        // Thanh chạy hết -> chuyển cảnh (timer gắn với animation nên luôn khớp hình ảnh)
                        <span key={index} className="block h-full rounded-full bg-white"
                          style={{ animation: `progress ${DURATION}ms linear forwards`, animationPlayState: paused ? 'paused' : 'running' }}
                          onAnimationEnd={() => go(index + 1)} />
                      ) : i < index ? <span className="block h-full bg-white/70" /> : null}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => go(index - 1)} className="rounded-full p-1 hover:bg-white/15" aria-label="Cảnh trước"><ChevronLeft size={16} /></button>
                  <button onClick={() => go(index + 1)} className="rounded-full p-1 hover:bg-white/15" aria-label="Cảnh sau"><ChevronRight size={16} /></button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chấm chuyển cảnh trên mobile */}
        <div className="absolute right-5 top-24 z-30 flex flex-col gap-2 lg:hidden">
          {SLIDES.map((s, i) => (
            <button key={s.word} onClick={() => go(i)} aria-label={`Cảnh ${i + 1}`}
              className={`w-1.5 overflow-hidden rounded-full bg-white/40 transition-all duration-500 ${i === index ? 'h-8' : 'h-1.5'}`}>
              {/* Bản desktop ẩn phần này (display:none -> animation không chạy) nên không bị chuyển cảnh 2 lần */}
              {i === index && (
                <span key={index} className="block w-full rounded-full bg-white"
                  style={{ animation: `progress-y ${DURATION}ms linear forwards` }} onAnimationEnd={() => go(index + 1)} />
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
