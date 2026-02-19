import { Home, AppWindow, Users, FileText, Server, Monitor, type LucideIcon } from 'lucide-react'

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
  { id: 'k8s', label: 'K8s 클러스터 관리', icon: Server, path: '/k8s' },
  { id: 'servers', label: '서버 관리', icon: Monitor, path: '/servers' },
  { id: 'audit', label: '감사 로그', icon: FileText, path: '/audit' },
]
