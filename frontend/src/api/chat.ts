import { AxiosError, AxiosHeaders } from 'axios'
import { useAuth } from '../store/auth'
import type { ChatAction, Product } from './types'

export type ChatEvent =
  | { type: 'delta'; text: string }
  | { type: 'action'; action: ChatAction }
  | { type: 'products'; products: Product[] }
  | { type: 'done'; provider: string }

interface ChatRequest {
  messages: { role: 'user' | 'assistant'; content: string }[]
  cart: { product_id: number; variant_label: string | null; grind: string | null; quantity: number }[]
}

/**
 * Gọi POST /api/chat/stream và đọc Server-Sent Events.
 * Dùng fetch thay vì axios vì axios (trên trình duyệt) không đọc được body theo từng mảnh.
 */
export async function streamChat(body: ChatRequest, onEvent: (ev: ChatEvent) => void): Promise<void> {
  const token = useAuth.getState().token
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) {
    // Ném lỗi dạng AxiosError để errorMessage() đọc được "detail" giống các API khác
    const data = await res.json().catch(() => ({}))
    throw new AxiosError('Chat failed', String(res.status), undefined, undefined,
      { data, status: res.status, statusText: res.statusText, headers: {}, config: { headers: new AxiosHeaders() } })
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    // Mỗi sự kiện kết thúc bằng một dòng trống
    let sep: number
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      for (const line of chunk.split('\n')) {
        if (line.startsWith('data:')) onEvent(JSON.parse(line.slice(5)) as ChatEvent)
      }
    }
  }
}
