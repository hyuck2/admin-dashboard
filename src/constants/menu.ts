import { Home, AppWindow, Users, FileText, type LucideIcon } from 'lucide-react'

export interface MenuItem {
  id: string
  label: string
  icon: LucideIcon
  path: string
}

export const MENU_ITEMS: MenuItem[] = [
  { id: 'home', label: '홈', icon: Home, path: '/' },
  { id: 'apps', label: 'UI Application 관리', icon: AppWindow, path: '/apps' },
  { id: 'users', label: '사용자 & 권한 관리', icon: Users, path: '/users' },
  { id: 'audit', label: '감사 로그', icon: FileText, path: '/audit' },
]
