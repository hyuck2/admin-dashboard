import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal, RefreshCw, Search } from 'lucide-react'
import { appService } from '../../services/appService'
import { useAuth } from '../../hooks/useAuth'
import type { AppStatus } from '../../types/app'
import Table from '../../components/ui/Table'
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
  const [rollbackTarget, setRollbackTarget] = useState<AppStatus | null>(null)
  const [replicaTarget, setReplicaTarget] = useState<AppStatus | null>(null)
  const [filterName, setFilterName] = useState('')
  const [filterEnv, setFilterEnv] = useState('')
  const [sortKey, setSortKey] = useState<string>('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

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

  const sortedApps = useMemo(() => {
    if (!sortKey) return filteredApps
    return [...filteredApps].sort((a, b) => {
      let va: string | number
      let vb: string | number
      if (sortKey === 'replica') {
        va = a.replicaCurrent
        vb = b.replicaCurrent
      } else {
        va = String((a as unknown as Record<string, unknown>)[sortKey] ?? '')
        vb = String((b as unknown as Record<string, unknown>)[sortKey] ?? '')
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredApps, sortKey, sortDir])

  const handleSort = (key: string) => {
    if (key === 'actions') return
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (colKey === 'actions') return null
    if (sortKey !== colKey) return <ArrowUpDown size={12} className="ml-1 opacity-30" />
    return sortDir === 'asc'
      ? <ArrowUp size={12} className="ml-1" />
      : <ArrowDown size={12} className="ml-1" />
  }

  const columns = [
    {
      key: 'appName',
      header: 'App 이름',
      sortable: true,
      render: (item: AppStatus) => <span className="font-medium">{item.appName}</span>,
    },
    {
      key: 'env',
      header: '환경',
      sortable: true,
      render: (item: AppStatus) => (
        <Badge variant={item.env === 'prod' ? 'danger' : 'default'}>{item.env}</Badge>
      ),
    },
    {
      key: 'deployVersion',
      header: '배포 버전',
      sortable: true,
      render: (item: AppStatus) => item.deployVersion,
    },
    {
      key: 'k8sVersion',
      header: 'K8s 버전',
      sortable: true,
      render: (item: AppStatus) => item.k8sVersion,
    },
    {
      key: 'syncStatus',
      header: '동기화',
      sortable: true,
      render: (item: AppStatus) => (
        <Badge variant={item.syncStatus === 'Synced' ? 'success' : 'danger'}>
          {item.syncStatus}
        </Badge>
      ),
    },
    {
      key: 'replica',
      header: 'Replica',
      sortable: true,
      render: (item: AppStatus) => `${item.replicaCurrent}/${item.replicaDesired}`,
    },
    {
      key: 'actions',
      header: '액션',
      className: 'w-16',
      render: (item: AppStatus) => {
        const canDeploy = user?.role === 'admin' || user?.permissions?.some(
          (p) => p.type === 'app_deploy' && p.target === item.appName && p.action === 'write'
        )
        if (!canDeploy) return null
        return (
          <Dropdown
            trigger={
              <button className="p-1 rounded-md hover:bg-bg-hover text-text-tertiary">
                <MoreHorizontal size={16} />
              </button>
            }
            items={[
              { label: 'Rollback', onClick: () => setRollbackTarget(item) },
              { label: 'Replica 변경', onClick: () => setReplicaTarget(item) },
            ]}
          />
        )
      },
    },
  ]

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
        <h1 className="text-lg font-semibold text-text-primary">UI Application 관리</h1>
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

      <Table
        columns={columns}
        data={sortedApps}
        keyExtractor={(item) => `${item.appName}-${item.env}`}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        renderSortIcon={(colKey) => <SortIcon colKey={colKey} />}
      />

      {rollbackTarget && (
        <RollbackModal
          app={rollbackTarget}
          onClose={() => setRollbackTarget(null)}
          onComplete={fetchApps}
        />
      )}

      {replicaTarget && (
        <ReplicaModal
          app={replicaTarget}
          onClose={() => setReplicaTarget(null)}
          onComplete={fetchApps}
        />
      )}
    </div>
  )
}
