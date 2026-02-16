import { useEffect, useState } from 'react'
import { MoreHorizontal, RefreshCw } from 'lucide-react'
import { appService } from '../../services/appService'
import type { AppStatus } from '../../types/app'
import Table from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Dropdown from '../../components/ui/Dropdown'
import Spinner from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'
import RollbackModal from './RollbackModal'
import ReplicaModal from './ReplicaModal'

export default function AppsPage() {
  const [apps, setApps] = useState<AppStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [rollbackTarget, setRollbackTarget] = useState<AppStatus | null>(null)
  const [replicaTarget, setReplicaTarget] = useState<AppStatus | null>(null)

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

  const columns = [
    {
      key: 'appName',
      header: 'App 이름',
      render: (item: AppStatus) => <span className="font-medium">{item.appName}</span>,
    },
    {
      key: 'env',
      header: '환경',
      render: (item: AppStatus) => (
        <Badge variant={item.env === 'prod' ? 'danger' : 'default'}>{item.env}</Badge>
      ),
    },
    {
      key: 'deployVersion',
      header: '배포 버전',
      render: (item: AppStatus) => item.deployVersion,
    },
    {
      key: 'k8sVersion',
      header: 'K8s 버전',
      render: (item: AppStatus) => item.k8sVersion,
    },
    {
      key: 'syncStatus',
      header: '동기화',
      render: (item: AppStatus) => (
        <Badge variant={item.syncStatus === 'Synced' ? 'success' : 'danger'}>
          {item.syncStatus}
        </Badge>
      ),
    },
    {
      key: 'replica',
      header: 'Replica',
      render: (item: AppStatus) => `${item.replicaCurrent}/${item.replicaDesired}`,
    },
    {
      key: 'actions',
      header: '액션',
      className: 'w-16',
      render: (item: AppStatus) => (
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
      ),
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

      <Table
        columns={columns}
        data={apps}
        keyExtractor={(item) => `${item.appName}-${item.env}`}
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
