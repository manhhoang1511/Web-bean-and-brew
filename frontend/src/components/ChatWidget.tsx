import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { Bot, CheckCircle2, MessageCircle, RotateCcw, Send, ShoppingBag, X } from 'lucide-react'
import { errorMessage, imageUrl } from '../api/client'
import { streamChat } from '../api/chat'
import type { ChatMessage, Product } from '../api/types'
import { lineLabel, useCart } from '../store/cart'
import { formatVND } from '../lib/format'
import { useMeta } from '../lib/meta'
import { flyToCart } from '../lib/animations'
import { addToCartWithToast } from './ProductCard'

const GREETING: ChatMessage = {
  role: 'assistant',
  content: 'Xin chào 👋 Mình là **Bean** – trợ lý tư vấn của Bean & Brew. Bạn thích cà phê vị gì, pha bằng gì, ngân sách bao nhiêu? Mình sẽ gợi ý ngay!',
}
const SUGGESTIONS = ['Cà phê đậm vị pha phin', 'Loại nào chua thanh?', 'Thêm 1 gói Robusta 500g xay phin vào giỏ', 'Có mã giảm giá không?']
const STORAGE_KEY = 'bb-chat'

function loadHistory(): ChatMessage[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(saved) && saved.length ? saved : [GREETING]
  } catch {
    return [GREETING]
  }
}

function MiniProduct({ p }: { p: Product }) {
  const add = useCart((s) => s.add)
  return (
    <div className="flex w-52 shrink-0 items-center gap-2 rounded-xl border border-coffee-100 bg-surface p-2">
      <Link to={`/products/${p.slug}`}><img src={imageUrl(p.image_url)} alt="" className="h-12 w-12 rounded-lg object-cover" /></Link>
      <div className="min-w-0 flex-1">
        <Link to={`/products/${p.slug}`} className="line-clamp-1 text-xs font-semibold hover:text-caramel-600">{p.name}</Link>
        <p className="text-xs font-bold text-caramel-600">{formatVND(p.price)}</p>
      </div>
      <button
        className="rounded-lg bg-coffee-800 p-1.5 text-cream-50 hover:bg-caramel-500 disabled:bg-coffee-200"
        disabled={!p.in_stock}
        onClick={() => addToCartWithToast(add, p)}
        aria-label="Thêm vào giỏ"
      >
        <ShoppingBag size={14} />
      </button>
    </div>
  )
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [provider, setProvider] = useState<string>('')
  const addToCart = useCart((s) => s.add)
  const meta = useMeta()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    // Đang stream thì cuộn tức thì để không bị giật
    endRef.current?.scrollIntoView({ behavior: loading ? 'auto' : 'smooth' })
  }, [messages, open, loading])

  const send = async (text: string) => {
    const content = text.trim()
    if (!content || loading) return
    const next: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setLoading(true)
    // Bỏ lời chào mặc định và danh sách sản phẩm trước khi gửi lên server
    const history = next.filter((m) => m.content !== GREETING.content).map(({ role, content }) => ({ role, content }))
    // Gửi giỏ hiện tại (kèm toàn bộ tùy chọn dạng chữ) để chatbot tư vấn theo ngữ cảnh
    const cart = useCart.getState().items.map((i) => ({
      product_id: i.product.id, variant_label: lineLabel(i) || null, grind: null, quantity: i.quantity,
    }))
    // Cập nhật tin nhắn trợ lý cuối cùng khi có dữ liệu stream mới
    let reply: ChatMessage = { role: 'assistant', content: '', products: [], added: [] }
    const render = () => setMessages([...next, { ...reply }])
    try {
      await streamChat({ messages: history, cart }, (ev) => {
        if (ev.type === 'delta') {
          reply = { ...reply, content: reply.content + ev.text }
        } else if (ev.type === 'action') {
          const { product, variant_id, grind, sugar, ice, toppings, quantity } = ev.action
          const variant = product.variants.find((v) => v.id === variant_id) ?? null
          // Ghép tên + giá topping từ /api/meta để giỏ hàng hiển thị và tính tiền
          const chosen = toppings.flatMap((c) => {
            const t = meta.toppings.find((x) => x.id === c.topping_id)
            return t ? [{ id: t.id, name: t.name, price: t.price, quantity: c.quantity }] : []
          })
          addToCart(product, quantity, { variant, grind, sugar, ice, toppings: chosen })
          flyToCart(document.querySelector<HTMLElement>('button.fixed.bottom-5'), product.image_url)
          reply = { ...reply, added: [...(reply.added ?? []), ev.action] }
        } else if (ev.type === 'products') {
          reply = { ...reply, products: ev.products }
        } else if (ev.type === 'done') {
          setProvider(ev.provider)
        }
        render()
      })
      if (!reply.content) reply.content = 'Xin lỗi, mình chưa có câu trả lời. Bạn hỏi lại giúp mình nhé!'
      render()
    } catch (err) {
      setMessages([...next, { role: 'assistant', content: `⚠️ ${errorMessage(err, 'Trợ lý đang bận, bạn thử lại sau nhé.')}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-espresso-800 text-white shadow-xl shadow-coffee-900/30 transition hover:scale-105 hover:bg-caramel-500"
        aria-label="Mở trợ lý tư vấn"
      >
        {!open && <span className="absolute inset-0 rounded-full bg-caramel-500 animate-ping-slow" aria-hidden />}
        <span key={String(open)} className="relative animate-pop">{open ? <X size={24} /> : <MessageCircle size={24} />}</span>
        {!open && <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full bg-caramel-500 ring-2 ring-white" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-4 z-40 flex h-[min(600px,calc(100vh-8rem))] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-3xl border border-coffee-100 bg-cream-50 shadow-2xl shadow-coffee-900/20 origin-bottom-right animate-[pop_.35s_cubic-bezier(.3,1.4,.5,1)] sm:right-5">
          <div className="flex items-center gap-3 bg-espresso-800 px-4 py-3.5 text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-caramel-500"><Bot size={22} /></span>
            <div className="flex-1">
              <p className="font-semibold">Bean – Trợ lý tư vấn</p>
              <p className="flex items-center gap-1.5 text-xs text-latte-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {provider === 'offline' ? 'Chế độ offline' : provider ? `AI · ${provider}` : 'Trực tuyến'}
              </p>
            </div>
            <button className="rounded-lg p-1.5 hover:bg-white/10" title="Cuộc trò chuyện mới" onClick={() => setMessages([GREETING])}>
              <RotateCcw size={16} />
            </button>
          </div>

          <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-4" data-lenis-prevent>
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                {(m.content || m.role === 'user') && (
                  <div className={`prose-chat max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === 'user' ? 'rounded-br-md bg-coffee-800 text-cream-50' : 'rounded-bl-md border border-coffee-100 bg-surface'}`}>
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                )}
                {!!m.added?.length && (
                  <Link to="/cart" className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-100">
                    <CheckCircle2 size={16} className="shrink-0" />
                    Đã thêm {m.added.reduce((n, a) => n + a.quantity, 0)} sản phẩm vào giỏ · <span className="underline">Xem giỏ hàng</span>
                  </Link>
                )}
                {!!m.products?.length && (
                  <div className="scrollbar-thin mt-2 flex max-w-full gap-2 overflow-x-auto pb-1">
                    {m.products.map((p) => <MiniProduct key={p.id} p={p} />)}
                  </div>
                )}
              </div>
            ))}
            {loading && !messages[messages.length - 1]?.content && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex w-16 items-center justify-center gap-1 rounded-2xl rounded-bl-md border border-coffee-100 bg-surface px-3.5 py-3.5">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-coffee-300" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            )}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-coffee-200 bg-surface px-3 py-1.5 text-xs font-medium text-coffee-700 hover:border-caramel-500 hover:text-caramel-600">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="flex gap-2 border-t border-coffee-100 bg-surface p-3">
            <input className="input rounded-full" placeholder="Nhập câu hỏi…" value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} />
            <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-caramel-500 text-white hover:bg-caramel-600 disabled:opacity-40" disabled={!input.trim() || loading} aria-label="Gửi">
              <Send size={17} />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
