import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronRight, MoreHorizontal, RefreshCw } from 'lucide-react'
import { k8sService } from '../../services/k8sService'
import type { DeploymentInfo } from '../../types/k8s'
import Table from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Dropdown from '../../components/ui/Dropdown'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
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

export default function DeploymentListPage() {
  const { context, namespace } = useParams<{ context: string; namespace: string }>()
  const [deployments, setDeployments] = useState<DeploymentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [scaleTarget, setScaleTarget] = useState<DeploymentInfo | null>(null)
  const [logTarget, setLogTarget] = useState<DeploymentInfo | null>(null)
  const [restartTarget, setRestartTarget] = useState<DeploymentInfo | null>(null)
  const [editTarget, setEditTarget] = useState<DeploymentInfo | null>(null)
  const [execTarget, setExecTarget] = useState<DeploymentInfo | null>(null)
  const [restarting, setRestarting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  if (!context || !namespace) return null

  const fetchDeploys = async () => {
    setLoading(true)
    try {
      setDeployments(await k8sService.getDeployments(context, namespace))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDeploys()
    const interval = setInterval(fetchDeploys, 10000)
    return () => clearInterval(interval)
  }, [context, namespace])

  const handleRestart = async () => {
    if (!restartTarget) return
    setRestarting(true)
    try {
      await k8sService.restartDeployment(context, namespace, restartTarget.name)
      showToast(`${restartTarget.name} 재시작 요청 완료`, 'success')
      setRestartTarget(null)
      fetchDeploys()
    } catch (e) {
      showToast(e instanceof Error ? e.message : '재시작 실패', 'error')
    } finally {
      setRestarting(false)
    }
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const columns = [
    {
      key: 'name',
      header: 'Deployment',
      render: (d: DeploymentInfo) => (
        <Link
          to={`/k8s/${context}/${namespace}/${d.name}`}
          className="font-medium text-accent hover:underline"
        >
          {d.name}
        </Link>
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
        <span className="text-xs text-text-secondary truncate max-w-[250px] block">{d.image}</span>
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
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-1 text-sm text-text-secondary mb-4">
        <Link to="/k8s" className="hover:text-accent">K8s 클러스터</Link>
        <ChevronRight size={14} />
        <Link to={`/k8s/${context}`} className="hover:text-accent">{context}</Link>
        <ChevronRight size={14} />
        <span className="text-text-primary font-medium">{namespace}</span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-text-primary">
          Deployments — {namespace}
        </h1>
        <Button variant="ghost" size="sm" onClick={fetchDeploys}>
          <RefreshCw size={14} className="mr-1" />
          새로고침
        </Button>
      </div>

      <Table
        columns={columns}
        data={deployments}
        keyExtractor={(d) => d.name}
      />

      {scaleTarget && (
        <ScaleModal
          context={context}
          namespace={namespace}
          deployment={scaleTarget}
          onClose={() => setScaleTarget(null)}
          onComplete={() => { setScaleTarget(null); fetchDeploys() }}
          onToast={showToast}
        />
      )}

      {logTarget && (
        <LogViewer
          context={context}
          namespace={namespace}
          deploymentName={logTarget.name}
          onClose={() => setLogTarget(null)}
        />
      )}

      {editTarget && (
        <EditModal
          context={context}
          namespace={namespace}
          deploymentName={editTarget.name}
          onClose={() => setEditTarget(null)}
          onComplete={() => { setEditTarget(null); fetchDeploys() }}
          onToast={showToast}
        />
      )}

      {execTarget && (
        <ExecModal
          context={context}
          namespace={namespace}
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
