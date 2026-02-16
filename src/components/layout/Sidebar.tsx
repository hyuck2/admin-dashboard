import { useContext } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { SidebarContext } from '../../contexts/SidebarContext'
import { MENU_ITEMS } from '../../constants/menu'
import { cn } from '../../utils/cn'

export default function Sidebar() {
  const { collapsed, toggleSidebar } = useContext(SidebarContext)!
  const location = useLocation()

  return (
    <aside
      className={cn(
        'h-screen bg-sidebar-bg flex flex-col transition-all duration-200 flex-shrink-0',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      <div className={cn('flex items-center h-12 px-4 border-b border-white/10', collapsed ? 'justify-center' : '')}>
        {!collapsed && (
          <span className="text-sm font-semibold text-sidebar-text-active truncate">
            Admin
          </span>
        )}
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {MENU_ITEMS.map((item) => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path)
          const Icon = item.icon

          return (
            <Link
              key={item.id}
              to={item.path}
              className={cn(
                'flex items-center gap-3 mx-2 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-sidebar-active/20 text-sidebar-text-active'
                  : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active',
                collapsed && 'justify-center px-0',
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center h-10 border-t border-white/10 text-sidebar-text hover:text-sidebar-text-active transition-colors"
      >
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>
    </aside>
  )
}
