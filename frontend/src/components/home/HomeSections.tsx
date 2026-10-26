import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Play, Quote, Star, X } from 'lucide-react'
import { api, imageUrl } from '../../api/client'
import type { Category, Page, Product } from '../../api/types'
import { formatVND } from '../../lib/format'
import { useMagnetic, useScrollProgress } from '../../lib/animations'
import Reveal from '../Reveal'
import { getLenis } from '../../lib/smoothScroll'

const WM = 'https://upload.wikimedia.org/wikipedia/commons/'
const UNS = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

/** Video giấy phép mở (Wikimedia Commons) – ghi công tác giả theo điều kiện giấy phép */
export const VIDEOS = {
  espresso: {
    loop: WM + 'transcoded/2/21/Morning_Espresso_Routine_%28abridged_version%29.webm/Morning_Espresso_Routine_%28abridged_version%29.webm.480p.vp9.webm',
    full: WM + '2/21/Morning_Espresso_Routine_%28abridged_version%29.webm',
    poster: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/21/Morning_Espresso_Routine_%28abridged_version%29.webm/1280px--Morning_Espresso_Routine_%28abridged_version%29.webm.jpg',
    credit: '“Morning Espresso Routine” – Scott Schiller, CC BY 2.0',
  },
  cherries: {
    loop: WM + 'transcoded/c/c2/Ripen_coffee_fruits%2C_Kodagu%2C_Karnataka.webm/Ripen_coffee_fruits%2C_Kodagu%2C_Karnataka.webm.480p.vp9.webm',
    poster: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c2/Ripen_coffee_fruits%2C_Kodagu%2C_Karnataka.webm/960px--Ripen_coffee_fruits%2C_Kodagu%2C_Karnataka.webm.jpg',
    credit: 'Subhashish Panigrahi, CC BY-SA 3.0',
  },
  harvest: {
    loop: WM + 'transcoded/0/05/Color_sorter_coffeebeans.webm/Color_sorter_coffeebeans.webm.720p.vp9.webm',
    poster: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/05/Color_sorter_coffeebeans.webm/1280px--Color_sorter_coffeebeans.webm.jpg',
    credit: 'AlexanderKlink, CC0',
  },
  milk: {
    loop: WM + 'transcoded/d/de/Milk_crown_HighSpeedPhoto.webm/Milk_crown_HighSpeedPhoto.webm.720p.vp9.webm',
    poster: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Milk_crown_HighSpeedPhoto.webm/1280px--Milk_crown_HighSpeedPhoto.webm.jpg',
    credit: 'Phonon.b, CC BY-SA 4.0',
  },
}

/** Tiêu đề hiện lần lượt từng chữ khi cuộn tới */
export function SplitTitle({ text, className = '' }: { text: string; className?: string }) {
  return (
    <Reveal as="h2" effect="fade" className={`split-title ${className}`}>
      {/* dấu cách phải nằm NGOÀI span inline-block, nếu không trình duyệt sẽ bỏ đi -> chữ dính liền */}
      {text.split(' ').map((w, i) => (
        <Fragment key={i}>
          <span className="word-mask"><span className="word" style={{ '--w': i } as CSSProperties}>{w}</span></span>{' '}
        </Fragment>
      ))}
    </Reveal>
  )
}

export function SectionHeader({ eyebrow, title, link, linkText = 'Xem tất cả', light }: {
  eyebrow: string; title: string; link?: string; linkText?: string; light?: boolean
}) {
  return (
    <div className="mb-10 flex items-end justify-between gap-4">
      <div>
        <Reveal as="p" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-caramel-500">
          <span className="h-px w-8 bg-caramel-500" /> {eyebrow}
        </Reveal>
        <SplitTitle text={title} className={`mt-2 font-display text-3xl font-bold sm:text-5xl ${light ? 'text-latte-50' : ''}`} />
      </div>
      {link && (
        <Link to={link} className={`group hidden shrink-0 items-center gap-1 text-sm font-semibold sm:flex ${light ? 'text-latte-100 hover:text-caramel-400' : 'text-coffee-700 hover:text-caramel-600'}`}>
          {linkText} <ArrowRight size={16} className="transition group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  )
}

/** Video tự phát (tắt tiếng) chỉ khi đang hiện trên màn hình -> tiết kiệm CPU / băng thông */
export function LazyVideo({ src, poster, className = '' }: { src: string; poster?: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (!v.src) v.src = src
        v.play().catch(() => {})
      } else v.pause()
    }, { threshold: 0.25 })
    io.observe(v)
    return () => io.disconnect()
  }, [src])
  return <video ref={ref} poster={poster} muted loop playsInline preload="none" className={className} aria-hidden />
}

/** Đoạn văn sáng dần từng chữ theo tiến độ cuộn */
export function ScrollTextReveal({ text }: { text: string }) {
  const ref = useScrollProgress<HTMLParagraphElement>('enter')
  const words = text.split(' ')
  return (
    <p ref={ref} className="scroll-text font-display text-3xl font-semibold leading-snug sm:text-5xl sm:leading-tight" style={{ '--n': words.length } as CSSProperties}>
      {words.map((w, i) => <span key={i} style={{ '--i': i } as CSSProperties}>{w} </span>)}
    </p>
  )
}

/** Huy hiệu chữ chạy vòng tròn */
export function CircleBadge({ className = '' }: { className?: string }) {
  return (
    <div className={`relative h-36 w-36 ${className}`} aria-hidden>
      <svg viewBox="0 0 200 200" className="h-full w-full animate-[spin_18s_linear_infinite]">
        <defs><path id="circle" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" /></defs>
        <text className="fill-coffee-800 text-[17px] font-semibold uppercase tracking-[0.3em]">
          <textPath href="#circle">Rang mới mỗi tuần • Bean & Brew • Since 2024 • </textPath>
        </text>
      </svg>
      <span className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-caramel-500 text-2xl">☕</span>
    </div>
  )
}

export function AboutIntro() {
  return (
    <section className="container-page mt-28">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
        <div>
          <Reveal as="p" className="mb-6 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-caramel-600">
            <span className="h-px w-8 bg-caramel-500" /> Về Bean & Brew
          </Reveal>
          <ScrollTextReveal text="Chúng tôi tin một tách cà phê ngon bắt đầu từ nông trại. Mỗi tuần, Bean & Brew rang những mẻ hạt nhỏ từ Cầu Đất, Buôn Ma Thuột đến Ethiopia – rồi pha chúng theo đúng gu của bạn." />
        </div>
        <Reveal effect="zoom" className="hidden justify-self-center lg:block"><CircleBadge /></Reveal>
      </div>
    </section>
  )
}

/** Video "chiếu rạp": khung video phóng to dần thành toàn màn hình khi cuộn tới */
export function VideoShowcase() {
  const ref = useScrollProgress<HTMLDivElement>('enter')
  const playRef = useMagnetic<HTMLButtonElement>(0.4)
  const [open, setOpen] = useState(false)
  const v = VIDEOS.espresso
  // Esc để đóng + khóa cuộn trang khi đang xem video
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    getLenis()?.stop() // tạm dừng cuộn mượt khi đang xem video
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; getLenis()?.start() }
  }, [open])
  return (
    <section className="mt-28">
      <div className="container-page"><SectionHeader eyebrow="Video" title="Xem chúng tôi pha một tách espresso" /></div>
      <div ref={ref} className="video-stage relative mx-auto aspect-video max-h-[88vh] overflow-hidden bg-espresso-900 shadow-2xl">
        <LazyVideo src={v.loop} poster={v.poster} className="video-zoom absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-espresso-900/80 via-espresso-900/20 to-espresso-900/40" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-center text-latte-50">
          <button ref={playRef} onClick={() => setOpen(true)} aria-label="Phát video"
            className="group relative flex h-24 w-24 items-center justify-center rounded-full bg-white/15 backdrop-blur-md transition hover:bg-caramel-500 sm:h-28 sm:w-28">
            <span className="absolute inset-0 rounded-full border-2 border-white/50 animate-ping-slow" />
            <Play size={36} className="ml-1.5 fill-white text-white transition group-hover:scale-110" />
          </button>
          <div className="px-6">
            <p className="font-display text-2xl font-bold sm:text-4xl">Từ hạt rang đến tách espresso</p>
            <p className="mt-2 text-sm text-latte-200">Xay · Phân bố · Nén · Chiết xuất – 25 giây quyết định hương vị</p>
          </div>
        </div>
        <p className="absolute bottom-3 right-4 text-[10px] text-white/50">{v.credit}</p>
      </div>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4 animate-fade-in" onClick={() => setOpen(false)}>
          <button className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Đóng video"><X /></button>
          <video src={v.full} poster={v.poster} controls autoPlay playsInline onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-5xl rounded-2xl shadow-2xl animate-[pop_.4s_ease-out]" />
        </div>
      )}
    </section>
  )
}

const JOURNEY = [
  { n: '01', title: 'Trồng & chăm sóc', desc: 'Cây cà phê trên độ cao 1.000–1.650m ở Lâm Đồng, Đắk Lắk. Chỉ hái quả chín đỏ mọng.', video: VIDEOS.cherries },
  { n: '02', title: 'Thu hái thủ công', desc: 'Từng quả được hái tay rồi phân loại, loại bỏ quả xanh để giữ vị ngọt tự nhiên.', video: VIDEOS.harvest },
  { n: '03', title: 'Rang mẻ nhỏ', desc: 'Rang thủ công từng mẻ 5kg mỗi thứ Hai, theo dõi nhiệt độ từng giây cho hương thơm trọn vẹn.', image: UNS('1525088553748-01d6e210e00b') },
  { n: '04', title: 'Pha theo gu bạn', desc: 'Espresso, phin, pour-over hay latte với size, đá, đường, topping do chính bạn chọn.', video: VIDEOS.milk },
]

/** Cuộn dọc nhưng nội dung trượt ngang qua 4 chặng (ghim màn hình). Mobile: xếp dọc. */
export function JourneyScroll() {
  const track = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(0)
  const ref = useScrollProgress<HTMLElement>('through', (p) => {
    const el = track.current
    if (!el || !window.matchMedia('(min-width: 1024px)').matches) { if (el) el.style.transform = ''; return }
    const max = el.scrollWidth - el.parentElement!.clientWidth
    el.style.transform = `translate3d(${-p * max}px, 0, 0)`
    setStep(Math.min(JOURNEY.length - 1, Math.floor(p * JOURNEY.length * 0.999)))
  })
  return (
    <section ref={ref} className="journey relative mt-28 bg-espresso-900 text-latte-50 lg:h-[320vh]">
      <div className="flex flex-col overflow-hidden py-20 lg:sticky lg:top-0 lg:h-screen lg:justify-center lg:py-0">
        <div className="container-page mb-10 flex items-end justify-between gap-6">
          <SectionHeader eyebrow="Hành trình" title="Từ nông trại đến tách cà phê" light />
          <div className="mb-10 hidden items-center gap-3 lg:flex">
            {JOURNEY.map((j, i) => (
              <span key={j.n} className={`h-1.5 rounded-full transition-all duration-500 ${i === step ? 'w-10 bg-caramel-500' : 'w-4 bg-white/20'}`} />
            ))}
          </div>
        </div>
        <div className="container-page">
          <div ref={track} className="flex flex-col gap-6 will-change-transform lg:flex-row lg:gap-8">
            {JOURNEY.map((j, i) => (
              <Reveal key={j.n} delay={i * 80} className="liquid group relative shrink-0 overflow-hidden rounded-3xl bg-espresso-800 lg:h-[62vh] lg:w-[46vw]">
                <div className="relative h-64 overflow-hidden lg:absolute lg:inset-0 lg:h-full">
                  {j.video
                    ? <LazyVideo src={j.video.loop} poster={j.video.poster} className="h-full w-full object-cover transition duration-1000 group-hover:scale-105" />
                    : <img src={j.image} alt="" loading="lazy" className="h-full w-full object-cover transition duration-1000 group-hover:scale-105" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-espresso-900 via-espresso-900/30 to-transparent" />
                </div>
                <div className="relative p-6 lg:absolute lg:inset-x-0 lg:bottom-0 lg:p-10">
                  <p className="font-display text-6xl font-bold text-caramel-500/80 lg:text-8xl">{j.n}</p>
                  <h3 className="mt-2 text-2xl font-bold lg:text-3xl">{j.title}</h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-latte-200 lg:text-base">{j.desc}</p>
                  {j.video && <p className="mt-3 text-[10px] text-white/40">Video: {j.video.credit}</p>}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

const CATEGORY_IMAGES: Record<string, string> = {
  'ca-phe-hat': '/static/products/kenya-aa.jpg',
  'ca-phe-bot': '/static/products/bot-hop-thiec.jpg',
  'ca-phe-pha-san': UNS('1461023058943-07fcbe16d735', 700),
  'tra-matcha': UNS('1515823064-d6e0c04616a7', 700),
  'dung-cu-pha-che': '/static/products/am-moka-pot.jpg',
  'banh-do-an-kem': '/static/products/cheesecake-pistachio.jpg',
  'do-uong-pha-che': UNS('1578314675249-a6910f80cc4e', 700),
}

/** Thẻ danh mục có ảnh: rê chuột -> ảnh phóng to, nút mũi tên trượt vào */
export function ExploreCategories() {
  const [cats, setCats] = useState<Category[]>([])
  useEffect(() => { api.get<Category[]>('/api/categories').then((r) => setCats(r.data)) }, [])
  return (
    <section className="container-page mt-28">
      <SectionHeader eyebrow="Khám phá" title="Mọi thứ cho tách cà phê hoàn hảo" link="/shop" linkText="Vào cửa hàng" />
      <div className="grid auto-rows-[180px] grid-cols-2 gap-4 sm:auto-rows-[220px] lg:grid-cols-4">
        {cats.map((c, i) => (
          <Reveal key={c.id} delay={i * 70} effect="zoom" className={i === 0 ? 'col-span-2 row-span-2' : i >= 5 ? 'col-span-2' : ''}>
            <Link to={`/shop?category=${c.slug}`} className="liquid group relative block h-full overflow-hidden rounded-3xl">
              <img src={imageUrl(CATEGORY_IMAGES[c.slug])} alt={c.name} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-espresso-900/85 via-espresso-900/20 to-transparent transition group-hover:from-espresso-900/95" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 text-latte-50">
                <div>
                  <p className="text-2xl">{c.icon}</p>
                  <p className={`mt-1 font-bold ${i === 0 ? 'text-2xl sm:text-3xl' : 'text-lg'}`}>{c.name}</p>
                  <p className="text-xs text-latte-200">{c.product_count} sản phẩm</p>
                </div>
                <span className="flex h-10 w-10 shrink-0 translate-x-4 items-center justify-center rounded-full bg-white text-espresso-900 opacity-0 transition duration-300 group-hover:translate-x-0 group-hover:opacity-100">
                  <ArrowRight size={18} />
                </span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/** 2 hàng sản phẩm chạy vô tận ngược chiều nhau (chỉ giới thiệu, bấm để xem chi tiết) */
export function ProductMarquee() {
  const [items, setItems] = useState<Product[]>([])
  useEffect(() => {
    api.get<Page<Product>>('/api/products', { params: { sort: 'bestseller', page_size: 20 } }).then((r) => setItems(r.data.items))
  }, [])
  if (!items.length) return null
  const rows = [items.slice(0, 10), items.slice(10, 20)]
  return (
    <section className="mt-28 overflow-hidden">
      <div className="container-page"><SectionHeader eyebrow="Được yêu thích" title="Sản phẩm tiêu biểu" link="/shop?sort=bestseller" linkText="Xem trong cửa hàng" /></div>
      <div className="space-y-5">
        {rows.map((row, r) => (
          <div key={r} className="group flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
            <div className={`flex w-max gap-5 pr-5 group-hover:[animation-play-state:paused] ${r ? 'animate-[marquee_60s_linear_infinite_reverse]' : 'animate-[marquee_55s_linear_infinite]'}`}>
              {[...row, ...row].map((p, i) => (
                <Link key={`${p.id}-${i}`} to={`/products/${p.slug}`}
                  className="flex w-72 shrink-0 items-center gap-4 rounded-2xl border border-coffee-100 bg-surface p-3 transition duration-300 hover:-translate-y-1 hover:border-caramel-400 hover:shadow-lg">
                  <img src={imageUrl(p.image_url)} alt="" loading="lazy" className="h-20 w-20 rounded-xl object-cover" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-caramel-600">{p.category?.name}</p>
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="text-sm text-coffee-500">{p.variants.length > 1 ? 'từ ' : ''}{formatVND(p.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

const REVIEWS = [
  { name: 'Nguyễn Văn An', role: 'Dân văn phòng', text: 'Robusta Gia Lai Honey pha phin sáng nào cũng tỉnh như sáo. Giao nhanh, đóng gói rất kỹ.', stars: 5 },
  { name: 'Trần Thị Bình', role: 'Home barista', text: 'Ethiopia Yirgacheffe chua sáng như trà, pha V60 thơm cả phòng. Rang rất đều tay.', stars: 5 },
  { name: 'Lê Hoàng Cường', role: 'Sinh viên', text: 'Trà sữa trân châu chọn ít đá 50% đường là chuẩn bài, trân châu dẻo thật sự.', stars: 5 },
  { name: 'Phạm Thu Dung', role: 'Chủ quán nhỏ', text: 'Nhập Blend Espresso cho quán, crema dày, khách khen nhiều. Giá sỉ hợp lý.', stars: 4 },
  { name: 'Hoàng Minh Đức', role: 'Mê cà phê', text: 'Trợ lý Bean tư vấn đúng gu, còn tự thêm vào giỏ hộ mình luôn – tiện cực.', stars: 5 },
  { name: 'Vũ Ngọc Hà', role: 'Mẹ bỉm', text: 'Cheesecake Basque và Bạc xỉu là combo chiều thứ Bảy của mình. Ship nhanh!', stars: 5 },
]

export function Testimonials() {
  return (
    <section className="container-page mt-28">
      <SectionHeader eyebrow="Khách hàng nói gì" title="Hơn 10.000 tách cà phê hạnh phúc" />
      <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
        {REVIEWS.map((r, i) => (
          <Reveal key={r.name} delay={(i % 3) * 100} className="mb-5 break-inside-avoid">
            <figure className="group card relative overflow-hidden p-6 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
              <Quote className="absolute -right-2 -top-2 h-20 w-20 text-coffee-50 transition duration-500 group-hover:rotate-12 group-hover:text-caramel-500/15" />
              <div className="relative flex gap-0.5 text-caramel-500">
                {Array.from({ length: 5 }, (_, s) => <Star key={s} size={15} fill={s < r.stars ? 'currentColor' : 'none'} />)}
              </div>
              <blockquote className="relative mt-3 leading-relaxed text-coffee-700">“{r.text}”</blockquote>
              <figcaption className="relative mt-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-caramel-500 font-bold text-white">{r.name.split(' ').pop()![0]}</span>
                <span><b className="block text-sm">{r.name}</b><span className="text-xs text-coffee-400">{r.role}</span></span>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/** Lời mời cuối trang: nền gradient chuyển động + nút nam châm vào cửa hàng */
export function FinalCTA() {
  const btn = useMagnetic<HTMLAnchorElement>(0.35)
  return (
    <section className="container-page mt-28">
      <Reveal effect="zoom">
        <div className="cta-gradient relative overflow-hidden rounded-[2.5rem] px-6 py-20 text-center text-white sm:py-28">
          <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl animate-float-slow" />
          <div className="pointer-events-none absolute -bottom-24 -right-10 h-80 w-80 rounded-full bg-espresso-900/30 blur-3xl animate-float" />
          <p className="relative text-sm font-semibold uppercase tracking-[0.3em] text-white/80">Sẵn sàng chưa?</p>
          <h2 className="relative mx-auto mt-4 max-w-3xl font-display text-4xl font-bold leading-tight sm:text-6xl">Chọn ngay hương vị dành riêng cho bạn</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-white/85">63 sản phẩm · miễn phí ship đơn từ 500k · mã WELCOME10 giảm 10% cho đơn đầu tiên</p>
          <Link ref={btn} to="/shop" className="relative mt-10 inline-flex items-center gap-3 rounded-full bg-white px-9 py-4 text-lg font-bold text-espresso-900 shadow-2xl transition-colors hover:bg-espresso-900 hover:text-white">
            Vào cửa hàng <ArrowRight size={20} />
          </Link>
        </div>
      </Reveal>
    </section>
  )
}
