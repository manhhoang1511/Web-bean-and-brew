import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { Bot, MessageCircle, RotateCcw, Send, ShoppingBag, X } from 'lucide-react'
import { api, errorMessage, imageUrl } from '../api/client'
import type { ChatMessage, Product } from '../api/types'
import { useCart } from '../store/cart'
import { formatVND } from '../lib/format'
import { addToCartWithToast } from './ProductCard'

const GREETING: ChatMessage = {
  role: 'assistant',
  content: 'Xin chào 👋 Mình là **Bean** – trợ lý tư vấn của Bean & Brew. Bạn thích cà phê vị gì, pha bằng gì, ngân sách bao nhiêu? Mình sẽ gợi ý ngay!',
}
const SUGGESTIONS = ['Cà phê đậm vị pha phin', 'Quà tặng dưới 300k', 'Loại nào chua thanh?', 'Có mã giảm giá không?']
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
    <div className="flex w-52 shrink-0 items-center gap-2 rounded-xl border border-coffee-100 bg-white p-2">
      <Link to={`/products/${p.slug}`}><img src={imageUrl(p.image_url)} alt="" className="h-12 w-12 rounded-lg object-cover" /></Link>
      <div className="min-w-0 flex-1">
        <Link to={`/products/${p.slug}`} className="line-clamp-1 text-xs font-semibold hover:text-caramel-600">{p.name}</Link>
        <p className="text-xs font-bold text-caramel-600">{formatVND(p.price)}</p>
      </div>
      <button
        className="rounded-lg bg-coffee-800 p-1.5 text-white hover:bg-caramel-500 disabled:bg-coffee-200"
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
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const send = async (text: string) => {
    const content = text.trim()
    if (!content || loading) return
    const next: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      // Bỏ lời chào mặc định và danh sách sản phẩm trước khi gửi lên server
      const history = next.filter((m) => m !== GREETING && m.content !== GREETING.content)
        .map(({ role, content }) => ({ role, content }))
      const { data } = await api.post<{ reply: string; products: Product[]; provider: string }>('/api/chat', { messages: history })
      setProvider(data.provider)
      setMessages([...next, { role: 'assistant', content: data.reply, products: data.products }])
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
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-coffee-800 text-white shadow-xl shadow-coffee-900/30 transition hover:scale-105 hover:bg-caramel-500"
        aria-label="Mở trợ lý tư vấn"
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
        {!open && <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full bg-caramel-500 ring-2 ring-white" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-4 z-40 flex h-[min(600px,calc(100vh-8rem))] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-3xl border border-coffee-100 bg-cream-50 shadow-2xl shadow-coffee-900/20 animate-slide-up sm:right-5">
          <div className="flex items-center gap-3 bg-coffee-800 px-4 py-3.5 text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-caramel-500"><Bot size={22} /></span>
            <div className="flex-1">
              <p className="font-semibold">Bean – Trợ lý tư vấn</p>
              <p className="flex items-center gap-1.5 text-xs text-coffee-200">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {provider === 'offline' ? 'Chế độ offline' : provider ? `AI · ${provider}` : 'Trực tuyến'}
              </p>
            </div>
            <button className="rounded-lg p-1.5 hover:bg-white/10" title="Cuộc trò chuyện mới" onClick={() => setMessages([GREETING])}>
              <RotateCcw size={16} />
            </button>
          </div>

          <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`prose-chat max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user' ? 'rounded-br-md bg-coffee-800 text-white' : 'rounded-bl-md border border-coffee-100 bg-white'}`}>
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
                {!!m.products?.length && (
                  <div className="scrollbar-thin mt-2 flex max-w-full gap-2 overflow-x-auto pb-1">
                    {m.products.map((p) => <MiniProduct key={p.id} p={p} />)}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex w-16 items-center justify-center gap-1 rounded-2xl rounded-bl-md border border-coffee-100 bg-white px-3.5 py-3.5">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-coffee-300" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            )}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-coffee-200 bg-white px-3 py-1.5 text-xs font-medium text-coffee-700 hover:border-caramel-500 hover:text-caramel-600">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="flex gap-2 border-t border-coffee-100 bg-white p-3">
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
