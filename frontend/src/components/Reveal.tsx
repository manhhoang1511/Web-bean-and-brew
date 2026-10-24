import type { CSSProperties, ElementType, ReactNode } from 'react'
import { useInView } from '../lib/animations'

type Effect = 'up' | 'left' | 'right' | 'zoom' | 'fade'

/** Hiện dần khi cuộn tới. `delay` (ms) dùng để tạo hiệu ứng lần lượt (stagger) cho danh sách. */
export default function Reveal({ children, effect = 'up', delay = 0, className = '', as: Tag = 'div' }: {
  children: ReactNode; effect?: Effect; delay?: number; className?: string; as?: ElementType
}) {
  const { ref, visible } = useInView<HTMLDivElement>()
  return (
    <Tag ref={ref} className={`reveal reveal-${effect} ${visible ? 'is-visible' : ''} ${className}`}
      style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}>
      {children}
    </Tag>
  )
}
