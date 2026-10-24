import { create } from 'zustand'

type Theme = 'light' | 'dark'
const KEY = 'bb-theme'

function initial(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* localStorage bị chặn */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const apply = (t: Theme) => document.documentElement.classList.toggle('dark', t === 'dark')

export const useTheme = create<{ theme: Theme; toggle: () => void }>()((set, get) => {
  const theme = initial()
  apply(theme)
  return {
    theme,
    toggle: () => {
      const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
      apply(next)
      try { localStorage.setItem(KEY, next) } catch { /* bỏ qua */ }
      set({ theme: next })
    },
  }
})
