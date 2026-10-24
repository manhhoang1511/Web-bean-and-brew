import { useEffect, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus, Star, X } from 'lucide-react'
import type { OrderStatus } from '../api/types'
import { ORDER_STATUS } from '../lib/format'

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin text-current ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-coffee-400">
      <Spinner className="h-8 w-8" />
    </div>
  )
}

export function Stars({ value, size = 14, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} sao`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = value >= i - 0.25
        const half = !filled && value >= i - 0.75
        const star = (
          <span className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute text-coffee-100" fill="currentColor" strokeWidth={0} />
            {(filled || half) && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: filled ? '100%' : '50%' }}>
                <Star size={size} className="text-caramel-500" fill="currentColor" strokeWidth={0} />
              </span>
            )}
          </span>
        )
        return onChange ? (
          <button key={i} type="button" onClick={() => onChange(i)} className="transition hover:scale-110">
            {star}
          </button>
        ) : (
          <span key={i}>{star}</span>
        )
      })}
    </div>
  )
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const s = ORDER_STATUS[status]
  return (
    <span className={`chip ${s.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

export function EmptyState({ icon, title, desc, action }: { icon: ReactNode; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-coffee-50 text-coffee-400">{icon}</div>
      <h3 className="text-lg font-semibold text-coffee-800">{title}</h3>
      {desc && <p className="mt-1 max-w-sm text-sm text-coffee-500">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null
  const nums: (number | '…')[] = []
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i)
    else if (nums[nums.length - 1] !== '…') nums.push('…')
  }
  const base = 'flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium transition'
  return (
    <nav className="flex items-center justify-center gap-1.5" aria-label="Phân trang">
      <button className={`${base} hover:bg-coffee-50 disabled:opacity-30`} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Trang trước">
        <ChevronLeft size={18} />
      </button>
      {nums.map((n, i) =>
        n === '…' ? (
          <span key={`e${i}`} className="px-1 text-coffee-300">…</span>
        ) : (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`${base} ${n === page ? 'bg-coffee-800 text-cream-50' : 'text-coffee-700 hover:bg-coffee-50'}`}
          >
            {n}
          </button>
        ),
      )}
      <button className={`${base} hover:bg-coffee-50 disabled:opacity-30`} disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Trang sau">
        <ChevronRight size={18} />
      </button>
    </nav>
  )
}

export function QuantityInput({ value, max, onChange, size = 'md' }: { value: number; max: number; onChange: (v: number) => void; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-8' : 'h-11'
  const w = size === 'sm' ? 'w-8' : 'w-11'
  return (
    <div className={`inline-flex ${h} items-center rounded-xl border border-coffee-100 bg-surface`}>
      <button type="button" className={`${w} flex h-full items-center justify-center text-coffee-600 hover:text-coffee-900 disabled:opacity-30`}
        onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Giảm">
        <Minus size={14} />
      </button>
      <input
        className="w-10 bg-transparent text-center text-sm font-semibold outline-none"
        value={value}
        inputMode="numeric"
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, '')) || 1
          onChange(Math.min(Math.max(n, 1), max))
        }}
      />
      <button type="button" className={`${w} flex h-full items-center justify-center text-coffee-600 hover:text-coffee-900 disabled:opacity-30`}
        onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Tăng">
        <Plus size={14} />
      </button>
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-espresso-900/40 p-4 backdrop-blur-sm animate-fade-in sm:items-center" onMouseDown={onClose}>
      <div className={`card my-8 w-full ${wide ? 'max-w-3xl' : 'max-w-md'} animate-slide-up`} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="flex items-center justify-between border-b border-coffee-100 px-6 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="rounded-lg p-1 text-coffee-400 hover:bg-coffee-50 hover:text-coffee-700" onClick={onClose} aria-label="Đóng">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, title, message, confirmText = 'Xác nhận', danger, loading, onConfirm, onClose }: {
  open: boolean; title: string; message: ReactNode; confirmText?: string; danger?: boolean; loading?: boolean
  onConfirm: () => void; onClose: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-sm text-coffee-600">{message}</div>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-outline" onClick={onClose}>Hủy</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={loading}>
          {loading && <Spinner className="h-4 w-4" />} {confirmText}
        </button>
      </div>
    </Modal>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-coffee-100/60 ${className}`} />
}
