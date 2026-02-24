import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, MoreHorizontal, RefreshCw, Search, AlertTriangle } from 'lucide-react'
import { appService } from '../../services/appService'
import { useAuth } from '../../hooks/useAuth'
import type { AppStatus, ComponentInfo } from '../../types/app'
import Badge from '../../components/ui/Badge'
import Dropdown from '../../components/ui/Dropdown'
import Spinner from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'
import RollbackModal from './RollbackModal'
import ReplicaModal from './ReplicaModal'

export default function AppsPage() {
  const { user } = useAuth()
  const [apps, setApps] = useState<AppStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set())
  const [rollbackTarget, setRollbackTarget] = useState<AppStatus | null>(null)
  const [replicaTarget, setReplicaTarget] = useState<{ app: AppStatus; component: ComponentInfo } | null>(null)
  const [filterName, setFilterName] = useState('')
  const [filterEnv, setFilterEnv] = useState('')

  const fetchApps = async () => {
    setLoading(true)
    try {
      const data = await appService.getApps()
      setApps(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchApps() }, [])

  const envOptions = useMemo(() => {
    const envs = new Set(apps.map((a) => a.env))
    return Array.from(envs).sort()
  }, [apps])

  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      if (filterName && !app.appName.toLowerCase().includes(filterName.toLowerCase())) return false
      if (filterEnv && app.env !== filterEnv) return false
      return true
    })
  }, [apps, filterName, filterEnv])

  const toggleExpand = (appKey: string) => {
    setExpandedApps((prev) => {
      const next = new Set(prev)
      if (next.has(appKey)) {
        next.delete(appKey)
      } else {
        next.add(appKey)
      }
      return next
    })
  }

  const canDeploy = (appName: string) => {
    return user?.role === 'admin' || user?.permissions?.some(
      (p) => p.type === 'app_deploy' && p.target === appName && p.action === 'write'
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-text-primary">Application 관리</h1>
        <Button variant="ghost" size="sm" onClick={fetchApps}>
          <RefreshCw size={14} className="mr-1" />
          새로고침
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="앱 이름 검색"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm bg-bg-primary text-text-primary border border-border-secondary rounded-md focus:outline-none focus:ring-1 focus:ring-accent w-48"
          />
        </div>
        <select
          value={filterEnv}
          onChange={(e) => setFilterEnv(e.target.value)}
          className="px-3 py-1.5 text-sm bg-bg-primary text-text-primary border border-border-secondary rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">전체 환경</option>
          {envOptions.map((env) => (
            <option key={env} value={env}>{env}</option>
          ))}
        </select>
        {(filterName || filterEnv) && (
          <button
            onClick={() => { setFilterName(''); setFilterEnv('') }}
            className="text-xs text-text-tertiary hover:text-text-primary"
          >
            필터 초기화
          </button>
        )}
      </div>

      <div className="bg-bg-primary border border-border-secondary rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-tertiary border-b border-border-secondary">
            <tr>
              <th className="px-4 py-2.5 text-left text-text-secondary font-medium w-10"></th>
              <th className="px-4 py-2.5 text-left text-text-secondary font-medium">앱 이름</th>
              <th className="px-4 py-2.5 text-left text-text-secondary font-medium">환경</th>
              <th className="px-4 py-2.5 text-left text-text-secondary font-medium">배포 버전</th>
              <th className="px-4 py-2.5 text-left text-text-secondary font-medium">동기화</th>
              <th className="px-4 py-2.5 text-left text-text-secondary font-medium">컴포넌트</th>
              <th className="px-4 py-2.5 text-left text-text-secondary font-medium">총 Replica</th>
              <th className="px-4 py-2.5 text-left text-text-secondary font-medium w-16">액션</th>
            </tr>
          </thead>
          <tbody>
            {filteredApps.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-tertiary">
                  앱이 없습니다
                </td>
              </tr>
            ) : (
              filteredApps.map((app) => {
                const appKey = `${app.appName}-${app.env}`
                const isExpanded = expandedApps.has(appKey)
                return (
                  <>
                    {/* Main row */}
                    <tr key={appKey} className="border-b border-border-primary hover:bg-bg-hover">
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => toggleExpand(appKey)}
                          className="text-text-tertiary hover:text-text-primary"
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-text-primary">{app.appName}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={app.env === 'prod' ? 'danger' : 'default'}>{app.env}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-text-primary">{app.deployVersion}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={app.overallSyncStatus === 'Synced' ? 'success' : 'danger'}>
                          {app.overallSyncStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary">{app.components.length}개</td>
                      <td className="px-4 py-2.5 text-text-primary">{app.totalReplicaCurrent}/{app.totalReplicaDesired}</td>
                      <td className="px-4 py-2.5">
                        {canDeploy(app.appName) && (
                          <Dropdown
                            trigger={
                              <button className="p-1 rounded-md hover:bg-bg-hover text-text-tertiary">
                                <MoreHorizontal size={16} />
                              </button>
                            }
                            items={[
                              { label: 'Rollback', onClick: () => setRollbackTarget(app) },
                            ]}
                          />
                        )}
                      </td>
                    </tr>

                    {/* Expanded component rows */}
                    {isExpanded && app.components.map((comp) => (
                      <tr key={`${appKey}-${comp.name}`} className="bg-bg-secondary border-b border-border-primary hover:bg-bg-hover">
                        <td className="px-4 py-2.5"></td>
                        <td className="px-4 py-2.5 text-text-primary pl-8">
                          <span className="text-xs text-text-tertiary mr-2">└</span>
                          {comp.name}
                        </td>
                        <td className="px-4 py-2.5 text-text-secondary text-xs">-</td>
                        <td className="px-4 py-2.5 text-text-secondary text-xs">
                          Deploy: {comp.deployVersion}<br/>
                          K8s: {comp.k8sVersion}
                          {comp.syncStatus === 'OutOfSync' && (
                            <AlertTriangle size={12} className="inline ml-1 text-danger" />
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant={comp.syncStatus === 'Synced' ? 'success' : 'danger'}>
                            {comp.syncStatus === 'Synced' ? '✓' : '⚠'}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-text-tertiary">-</td>
                        <td className="px-4 py-2.5 text-text-primary">{comp.replicaCurrent}/{comp.replicaDesired}</td>
                        <td className="px-4 py-2.5">
                          {canDeploy(app.appName) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setReplicaTarget({ app, component: comp })}
                            >
                              Scale
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {rollbackTarget && (
        <RollbackModal
          app={rollbackTarget}
          onClose={() => setRollbackTarget(null)}
          onComplete={() => {
            setRollbackTarget(null)
            fetchApps()
          }}
        />
      )}

      {replicaTarget && (
        <ReplicaModal
          open={true}
          app={replicaTarget.app}
          component={replicaTarget.component}
          onClose={() => setReplicaTarget(null)}
          onComplete={() => {
            setReplicaTarget(null)
            fetchApps()
          }}
        />
      )}
    </div>
  )
}
