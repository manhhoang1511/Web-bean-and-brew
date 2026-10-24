import { Flame, Minus, Plus, Snowflake } from 'lucide-react'
import type { Meta } from '../lib/meta'
import { formatVND } from '../lib/format'

/** Số viên đá minh họa cho từng mức (Nóng = lửa) */
const ICE_LEVEL: Record<string, number> = { 'Không đá': 0, 'Ít đá': 1, 'Vừa đá': 2, 'Nhiều đá': 3 }

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-semibold">{title}</p>
        {hint && <p className="text-xs text-coffee-400">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

export default function DrinkOptions({ meta, sugar, ice, toppingQty, allowToppings, onSugar, onIce, onTopping }: {
  meta: Meta
  sugar: string
  ice: string
  toppingQty: Record<number, number>
  allowToppings: boolean
  onSugar: (v: string) => void
  onIce: (v: string) => void
  onTopping: (id: number, qty: number) => void
}) {
  const totalToppings = Object.values(toppingQty).reduce((a, b) => a + b, 0)
  const sugarIdx = Math.max(0, meta.sugar_options.indexOf(sugar))

  return (
    <div className="space-y-5 rounded-2xl border border-coffee-100 bg-cream-100/50 p-4 sm:p-5">
      <Section title="Mức đá">
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {meta.ice_options.map((opt) => {
            const selected = opt === ice
            const hot = opt === 'Nóng'
            return (
              <button key={opt} onClick={() => onIce(opt)} aria-pressed={selected}
                className={`group flex min-w-0 flex-col items-center gap-1 rounded-xl border-2 px-0.5 py-2.5 text-[11px] font-medium sm:text-xs transition duration-200 active:scale-95 ${
                  selected ? 'border-caramel-500 bg-caramel-500/10 shadow-sm' : 'border-transparent bg-surface hover:-translate-y-0.5 hover:border-coffee-200'}`}>
                <span className={`flex h-6 items-end gap-0.5 ${selected ? 'animate-pop' : ''}`}>
                  {hot ? <Flame size={20} className="text-rose-500" /> : ICE_LEVEL[opt] === 0
                    ? <Snowflake size={18} className="text-coffee-300 opacity-50" />
                    : Array.from({ length: ICE_LEVEL[opt] }, (_, i) => (
                      <Snowflake key={i} size={14} className="text-sky-500" style={{ marginBottom: i % 2 ? 6 : 0 }} />
                    ))}
                </span>
                <span className="text-center leading-tight">{opt}</span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Mức đường" hint={sugar === '100%' ? 'Ngọt chuẩn vị quán' : sugar === '0%' ? 'Không đường' : undefined}>
        <div className="relative">
          {/* Thanh nền + phần đã chọn chạy mượt */}
          <div className="absolute left-[10%] right-[10%] top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-coffee-100">
            <div className="h-full rounded-full bg-gradient-to-r from-caramel-400 to-caramel-600 transition-all duration-300"
              style={{ width: `${(sugarIdx / (meta.sugar_options.length - 1)) * 100}%` }} />
          </div>
          <div className="relative grid grid-cols-5">
            {meta.sugar_options.map((opt, i) => {
              const active = i <= sugarIdx
              return (
                <button key={opt} onClick={() => onSugar(opt)} aria-pressed={opt === sugar} className="flex flex-col items-center gap-1.5 py-1">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-[11px] font-bold transition duration-300 ${
                    opt === sugar ? 'scale-110 border-caramel-500 bg-caramel-500 text-white shadow-lg shadow-caramel-500/30'
                      : active ? 'border-caramel-400 bg-surface text-caramel-600' : 'border-coffee-200 bg-surface text-coffee-400 hover:border-coffee-400'}`}>
                    {opt.replace('%', '')}
                  </span>
                  <span className={`text-[11px] ${opt === sugar ? 'font-semibold text-coffee-900' : 'text-coffee-400'}`}>{opt}</span>
                </button>
              )
            })}
          </div>
        </div>
      </Section>

      {allowToppings && meta.toppings.length > 0 && (
        <Section title="Topping" hint={`Đã chọn ${totalToppings}/${meta.max_toppings_total} phần · tối đa ${meta.max_topping_qty}/loại`}>
          <div className="grid gap-2 sm:grid-cols-2">
            {meta.toppings.map((t) => {
              const qty = toppingQty[t.id] ?? 0
              const canAdd = qty < meta.max_topping_qty && totalToppings < meta.max_toppings_total
              return (
                <div key={t.id} className={`flex items-center gap-2 rounded-xl border-2 bg-surface px-3 py-2 transition duration-200 ${
                  qty ? 'border-caramel-500/60 shadow-sm' : 'border-transparent'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-caramel-600">+{formatVND(t.price)}</p>
                  </div>
                  {qty > 0 && (
                    <>
                      <button onClick={() => onTopping(t.id, qty - 1)} aria-label={`Bớt ${t.name}`}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-coffee-200 transition hover:bg-coffee-50 active:scale-90 animate-fade-in">
                        <Minus size={13} />
                      </button>
                      <span key={qty} className="w-4 text-center text-sm font-bold animate-pop">{qty}</span>
                    </>
                  )}
                  <button onClick={() => onTopping(t.id, qty + 1)} disabled={!canAdd} aria-label={`Thêm ${t.name}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-coffee-800 text-cream-50 transition hover:bg-caramel-500 active:scale-90 disabled:cursor-not-allowed disabled:opacity-30">
                    <Plus size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        </Section>
      )}
    </div>
  )
}
