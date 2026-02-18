import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { k8sService } from '../../services/k8sService'
import type { DeploymentLogsResponse } from '../../types/k8s'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'

interface Props {
  context: string
  namespace: string
  deploymentName: string
  onClose: () => void
}

export default function LogViewer({ context, namespace, deploymentName, onClose }: Props) {
  const [data, setData] = useState<DeploymentLogsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedPod, setExpandedPod] = useState<string | null>(null)

  const fetchLogs = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await k8sService.getDeploymentLogs(context, namespace, deploymentName, 200)
      setData(result)
      if (result.pods.length > 0 && !expandedPod) {
        setExpandedPod(result.pods[0].podName)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLogs() }, [])

  return (
    <Modal open onClose={onClose} title={`Logs — ${deploymentName}`} maxWidth="max-w-3xl">
      <div className="min-h-[300px]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-text-secondary">
            {data ? `${data.totalPods} pod(s)` : ''}
          </span>
          <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw size={12} className="mr-1" />
            새로고침
          </Button>
        </div>

        {loading && !data && (
          <div className="flex items-center justify-center py-10">
            <Spinner className="h-5 w-5" />
          </div>
        )}

        {error && (
          <div className="p-3 bg-danger-light text-danger text-sm rounded-md">
            {error}
            <button onClick={fetchLogs} className="ml-2 underline">재시도</button>
          </div>
        )}

        {data && data.pods.length === 0 && (
          <p className="text-sm text-text-tertiary text-center py-8">로그가 없습니다.</p>
        )}

        {data && data.pods.map((pod) => (
          <div key={`${pod.podName}-${pod.containerName}`} className="mb-3">
            <button
              onClick={() => setExpandedPod(expandedPod === pod.podName ? null : pod.podName)}
              className="flex items-center gap-2 w-full text-left px-3 py-2 bg-bg-secondary border border-border-primary rounded-t-md hover:bg-bg-hover text-sm"
            >
              <Badge variant={pod.status === 'Running' ? 'success' : 'warning'}>{pod.status}</Badge>
              <span className="text-text-primary font-medium">{pod.podName}</span>
              <span className="text-text-tertiary text-xs">({pod.containerName})</span>
            </button>
            {expandedPod === pod.podName && (
              <pre className="p-3 bg-[#1e1e1e] text-[#d4d4d4] text-xs font-mono overflow-x-auto max-h-[300px] overflow-y-auto rounded-b-md border border-t-0 border-border-primary whitespace-pre-wrap">
                {pod.logs || '(empty)'}
              </pre>
            )}
          </div>
        ))}
      </div>
    </Modal>
  )
}
