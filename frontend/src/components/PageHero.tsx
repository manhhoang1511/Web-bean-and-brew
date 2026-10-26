import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export interface Crumb { label: string; to?: string }

const line = (l: number) => ({ '--l': l }) as CSSProperties

/**
 * Đầu trang tối kiểu tạp chí – dùng chung cho mọi trang khách hàng để đồng bộ với trang chủ 3D:
 * nền espresso + film grain + quầng sáng caramel, tiêu đề serif lớn trượt lên từng dòng.
 * Có `data-overlay-header` nên thanh menu tự chuyển sang dạng kính mờ khi nằm trên vùng này.
 */
export default function PageHero({ kicker, title, subtitle, image, crumbs = [], aside, children }: {
  kicker: ReactNode
  /** Mỗi phần tử là một dòng; dùng <em> để tô nghiêng màu caramel */
  title: ReactNode[]
  subtitle?: ReactNode
  image?: string
  crumbs?: Crumb[]
  /** Khối bên phải (số liệu, trạng thái…) */
  aside?: ReactNode
  children?: ReactNode
}) {
  return (
    <section data-overlay-header className="relative isolate overflow-hidden bg-espresso-900 text-latte-50">
      {image && (
        <div className="absolute inset-y-0 right-0 -z-10 w-full lg:w-[60%]">
          <img src={image} alt="" className="h-full w-full object-cover opacity-50 animate-kenburns" />
          <div className="absolute inset-0 bg-gradient-to-r from-espresso-900 via-espresso-900/75 to-espresso-900/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-espresso-900 via-transparent to-espresso-900/70" />
        </div>
      )}
      <div className="pointer-events-none absolute -left-32 top-1/4 -z-10 h-[55vh] w-[55vh] rounded-full bg-caramel-500/15 blur-[110px]" />
      <div className="grain pointer-events-none absolute inset-0" aria-hidden />

      <div className="container-page relative pb-10 pt-32 sm:pb-14 sm:pt-40">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-8">
          <div className="min-w-0">
            <p className="editorial-line flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.35em] text-caramel-400" style={line(0)}>
              <span className="h-px w-10 bg-caramel-400" /> {kicker}
            </p>
            <h1 className="mt-5 font-display text-[clamp(2.6rem,5.6vw,5.75rem)] font-semibold leading-[1] tracking-tight [overflow-wrap:anywhere]">
              {title.map((t, i) => (
                // pt chừa chỗ cho dấu tiếng Việt (Ầ, Ữ) không bị mặt nạ overflow cắt mất
                <span key={i} className="-mt-[0.15em] block overflow-hidden pb-[0.1em] pt-[0.15em]">
                  <span className="editorial-line block [&_em]:font-normal [&_em]:italic [&_em]:text-caramel-400" style={line(i + 1)}>{t}</span>
                </span>
              ))}
            </h1>
            {subtitle && (
              <p className="editorial-line mt-5 max-w-xl leading-relaxed text-latte-200" style={line(title.length + 1)}>{subtitle}</p>
            )}
          </div>
          {aside && <div className="editorial-line" style={line(title.length + 2)}>{aside}</div>}
        </div>

        {children && <div className="editorial-line mt-8" style={line(title.length + 2)}>{children}</div>}

        {crumbs.length > 0 && (
          <nav aria-label="Đường dẫn" className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 pt-5 text-[11px] font-medium uppercase tracking-[0.22em] text-latte-300">
            <Link to="/" className="transition hover:text-caramel-400">Trang chủ</Link>
            {crumbs.map((c) => (
              <Fragment key={c.label}>
                <span className="text-latte-400">/</span>
                {c.to ? <Link to={c.to} className="transition hover:text-caramel-400">{c.label}</Link> : <span className="text-latte-50">{c.label}</span>}
              </Fragment>
            ))}
          </nav>
        )}
      </div>
    </section>
  )
}

/** Con số lớn kiểu tạp chí cho khối `aside` của PageHero */
export function HeroStat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="text-left sm:text-right">
      <p className="font-display text-5xl font-semibold leading-none tabular-nums sm:text-6xl">{value}</p>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-latte-300">{label}</p>
    </div>
  )
}
