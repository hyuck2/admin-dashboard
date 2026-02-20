import { useAuth } from '../../hooks/useAuth'
import { AppWindow, Users, FileText, Server, Monitor } from 'lucide-react'
import { Link } from 'react-router-dom'

const quickLinks = [
  { icon: AppWindow, label: 'UI Application 관리', path: '/apps', description: '앱 상태 조회, 롤백, Replica 변경' },
  { icon: Users, label: '사용자 & 권한 관리', path: '/users', description: '사용자 및 그룹 권한 관리' },
  { icon: Server, label: 'K8s 클러스터 관리', path: '/k8s', description: '멀티 클러스터 노드/네임스페이스/배포 관리' },
  { icon: Monitor, label: '서버 관리', path: '/servers', description: 'SSH 서버 관리, 그룹 명령 실행, Ansible 자동화' },
  { icon: FileText, label: '감사 로그', path: '/audit', description: '시스템 변경 이력 조회' },
]

export default function HomePage() {
  const { user } = useAuth()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text-primary">
          안녕하세요, {user?.userId}님
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Admin Dashboard에 오신 것을 환영합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickLinks.map((link) => {
          const Icon = link.icon
          return (
            <Link
              key={link.path}
              to={link.path}
              className="block p-4 bg-bg-primary border border-border-primary rounded-lg hover:border-accent/50 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-accent-light rounded-md">
                  <Icon size={18} className="text-accent" />
                </div>
                <h2 className="text-sm font-medium text-text-primary">{link.label}</h2>
              </div>
              <p className="text-xs text-text-secondary">{link.description}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
