import { useEffect, useState } from 'react'

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} | Bean & Brew` : 'Bean & Brew – Cà phê rang xay'
  }, [title])
}
