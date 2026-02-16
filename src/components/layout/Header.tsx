import { Moon, Sun, LogOut } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'

export default function Header() {
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAuth()

  return (
    <header className="h-12 bg-bg-primary border-b border-border-primary flex items-center justify-end px-4 gap-3 flex-shrink-0">
      <button
        onClick={toggleTheme}
        className="p-1.5 rounded-md hover:bg-bg-hover text-text-secondary transition-colors"
        title={theme === 'light' ? '다크모드' : '라이트모드'}
      >
        {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
      </button>

      <span className="text-xs text-text-secondary">
        {user?.userId}
      </span>

      <button
        onClick={logout}
        className="p-1.5 rounded-md hover:bg-bg-hover text-text-secondary transition-colors"
        title="로그아웃"
      >
        <LogOut size={16} />
      </button>
    </header>
  )
}
