import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Search, MoreHorizontal } from 'lucide-react'
import { k8sService } from '../../services/k8sService'
import type { DeploymentInfo } from '../../types/k8s'
import Table from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import Dropdown from '../../components/ui/Dropdown'
import ConfirmModal from '../../components/ui/ConfirmModal'
import ScaleModal from './ScaleModal'
import LogViewer from './LogViewer'
import EditModal from './EditModal'
import ExecModal from './ExecModal'

function relativeTime(iso: string | null): string {
  if (!iso) return '-'
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}초 전`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  return `${day}일 전`
}

interface Props {
  context: string
  initialSearch?: string
}

export default function AllDeploymentList({ context, initialSearch = '' }: Props) {
  const [deployments, setDeployments] = useState<DeploymentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(initialSearch)
  const [scaleTarget, setScaleTarget] = useState<DeploymentInfo | null>(null)
  const [logTarget, setLogTarget] = useState<DeploymentInfo | null>(null)
  const [restartTarget, setRestartTarget] = useState<DeploymentInfo | null>(null)
  const [editTarget, setEditTarget] = useState<DeploymentInfo | null>(null)
  const [execTarget, setExecTarget] = useState<DeploymentInfo | null>(null)
  const [restarting, setRestarting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    setSearch(initialSearch)
  }, [initialSearch])

  const fetchDeploys = async () => {
    setLoading(true)
    try {
      setDeployments(await k8sService.getAllDeployments(context))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDeploys()
    const interval = setInterval(fetchDeploys, 10000)
    return () => clearInterval(interval)
  }, [context])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleRestart = async () => {
    if (!restartTarget) return
    setRestarting(true)
    try {
      await k8sService.restartDeployment(context, restartTarget.namespace, restartTarget.name)
      showToast(`${restartTarget.name} 재시작 요청 완료`, 'success')
      setRestartTarget(null)
      fetchDeploys()
    } catch (e) {
      showToast(e instanceof Error ? e.message : '재시작 실패', 'error')
    } finally {
      setRestarting(false)
    }
  }

  const filtered = useMemo(() => {
    if (!search) return deployments
    const q = search.toLowerCase()
    return deployments.filter(
      (d) => d.name.toLowerCase().includes(q) || d.namespace.toLowerCase().includes(q),
    )
  }, [deployments, search])

  const columns = [
    {
      key: 'name',
      header: 'Deployment',
      render: (d: DeploymentInfo) => (
        <Link
          to={`/k8s/${context}/${d.namespace}/${d.name}`}
          className="font-medium text-accent hover:underline"
        >
          {d.name}
        </Link>
      ),
    },
    {
      key: 'namespace',
      header: '네임스페이스',
      render: (d: DeploymentInfo) => (
        <button
          onClick={() => setSearch(d.namespace)}
          className="text-xs text-text-secondary hover:text-accent"
        >
          {d.namespace}
        </button>
      ),
    },
    {
      key: 'replicas',
      header: 'Replicas',
      render: (d: DeploymentInfo) => (
        <span className={d.readyReplicas < d.replicas ? 'text-warning' : ''}>
          {d.readyReplicas}/{d.replicas}
        </span>
      ),
    },
    {
      key: 'status',
      header: '상태',
      render: (d: DeploymentInfo) => (
        <Badge variant={d.status === 'Running' ? 'success' : d.status === 'Pending' ? 'warning' : 'danger'}>
          {d.status}
        </Badge>
      ),
    },
    {
      key: 'image',
      header: '이미지',
      render: (d: DeploymentInfo) => (
        <span className="text-xs text-text-secondary truncate max-w-[200px] block">{d.image}</span>
      ),
    },
    {
      key: 'updatedAt',
      header: '최근 업데이트',
      render: (d: DeploymentInfo) => (
        <span className="text-xs text-text-secondary">{relativeTime(d.updatedAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '액션',
      className: 'w-16',
      render: (d: DeploymentInfo) => (
        <Dropdown
          trigger={
            <button className="p-1 rounded-md hover:bg-bg-hover text-text-tertiary">
              <MoreHorizontal size={16} />
            </button>
          }
          items={[
            { label: 'Scale', onClick: () => setScaleTarget(d) },
            { label: 'Restart', onClick: () => setRestartTarget(d) },
            { label: 'Logs', onClick: () => setLogTarget(d) },
            { label: 'Edit', onClick: () => setEditTarget(d) },
            { label: 'Exec', onClick: () => setExecTarget(d) },
          ]}
        />
      ),
    },
  ]

  if (loading && deployments.length === 0) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner className="h-5 w-5" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="이름 또는 네임스페이스 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm bg-bg-primary text-text-primary border border-border-secondary rounded-md focus:outline-none focus:ring-1 focus:ring-accent w-56"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary text-xs"
            >
              &times;
            </button>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={fetchDeploys}>
          <RefreshCw size={14} className="mr-1" />
          새로고침
        </Button>
      </div>

      <Table
        columns={columns}
        data={filtered}
        keyExtractor={(d) => `${d.namespace}/${d.name}`}
      />

      {scaleTarget && (
        <ScaleModal
          context={context}
          namespace={scaleTarget.namespace}
          deployment={scaleTarget}
          onClose={() => setScaleTarget(null)}
          onComplete={() => { setScaleTarget(null); fetchDeploys() }}
          onToast={showToast}
        />
      )}

      {logTarget && (
        <LogViewer
          context={context}
          namespace={logTarget.namespace}
          deploymentName={logTarget.name}
          onClose={() => setLogTarget(null)}
        />
      )}

      {editTarget && (
        <EditModal
          context={context}
          namespace={editTarget.namespace}
          deploymentName={editTarget.name}
          onClose={() => setEditTarget(null)}
          onComplete={() => { setEditTarget(null); fetchDeploys() }}
          onToast={showToast}
        />
      )}

      {execTarget && (
        <ExecModal
          context={context}
          namespace={execTarget.namespace}
          deploymentName={execTarget.name}
          onClose={() => setExecTarget(null)}
        />
      )}

      <ConfirmModal
        open={!!restartTarget}
        onClose={() => setRestartTarget(null)}
        onConfirm={handleRestart}
        title="Deployment 재시작"
        message={`${restartTarget?.name}을(를) 재시작합니다. 계속하시겠습니까?`}
        confirmText="재시작"
        danger
        loading={restarting}
      />

      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded-md text-sm text-white shadow-lg ${toast.type === 'success' ? 'bg-success' : 'bg-danger'}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
