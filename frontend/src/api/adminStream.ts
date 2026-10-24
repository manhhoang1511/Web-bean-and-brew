import { useAuth } from '../store/auth'
import type { AdminEvent } from '../store/adminEvents'

/**
 * Kết nối SSE tới /api/admin/stream (fetch để gửi được header Authorization), tự kết nối lại khi rớt mạng.
 * Trả về hàm hủy kết nối.
 */
export function connectAdminStream(onEvent: (ev: AdminEvent) => void, onStatus: (connected: boolean) => void): () => void {
  let stopped = false
  let controller: AbortController | null = null

  const run = async () => {
    while (!stopped) {
      controller = new AbortController()
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/admin/stream`, {
          headers: { Authorization: `Bearer ${useAuth.getState().token}` },
          signal: controller.signal,
        })
        if (!res.ok || !res.body) throw new Error(String(res.status))
        onStatus(true)
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
        let buffer = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += value
          let sep: number
          while ((sep = buffer.indexOf('\n\n')) >= 0) {
            const chunk = buffer.slice(0, sep)
            buffer = buffer.slice(sep + 2)
            for (const line of chunk.split('\n')) {
              if (line.startsWith('data:')) onEvent(JSON.parse(line.slice(5)))
            }
          }
        }
      } catch {
        /* rớt kết nối hoặc bị hủy */
      }
      onStatus(false)
      if (!stopped) await new Promise((r) => setTimeout(r, 3000)) // thử lại sau 3 giây
    }
  }
  run()
  return () => {
    stopped = true
    controller?.abort()
  }
}

/** Âm "ting" ngắn bằng Web Audio, không cần file âm thanh */
export function playChime() {
  try {
    const ctx = new AudioContext()
    ;[880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      osc.connect(gain).connect(ctx.destination)
      const t = ctx.currentTime + i * 0.12
      gain.gain.setValueAtTime(0.15, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
      osc.start(t)
      osc.stop(t + 0.3)
    })
  } catch {
    /* trình duyệt chặn âm thanh khi chưa có tương tác */
  }
}
