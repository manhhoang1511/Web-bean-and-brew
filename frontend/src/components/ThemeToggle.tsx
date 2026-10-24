import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../store/theme'

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button onClick={toggle} className={`rounded-full p-2.5 transition hover:bg-coffee-50 ${className}`}
      aria-label={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'} title={dark ? 'Giao diện sáng' : 'Giao diện tối'}>
      {dark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  )
}
