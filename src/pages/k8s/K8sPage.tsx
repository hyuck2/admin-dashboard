import { useEffect, useState } from 'react'
import { RefreshCw, Server } from 'lucide-react'
import { k8sService } from '../../services/k8sService'
import type { ClusterInfo } from '../../types/k8s'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import ClusterCard from './ClusterCard'

export default function K8sPage() {
  const [clusters, setClusters] = useState<ClusterInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchClusters = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await k8sService.getClusters()
      setClusters(data.clusters)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load clusters')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClusters()
    const interval = setInterval(fetchClusters, 15000)
    return () => clearInterval(interval)
  }, [])

  if (loading && clusters.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-text-primary">Kubernetes 클러스터 관리</h1>
          {loading && <Spinner className="h-4 w-4 text-text-tertiary" />}
        </div>
        <Button variant="ghost" size="sm" onClick={fetchClusters}>
          <RefreshCw size={14} className="mr-1" />
          새로고침
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-danger-light text-danger text-sm rounded-md">
          {error}
          <button onClick={fetchClusters} className="ml-2 underline">재시도</button>
        </div>
      )}

      {clusters.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
          <Server size={48} className="mb-3 opacity-30" />
          <p className="text-sm">등록된 클러스터가 없습니다.</p>
          <p className="text-xs mt-1">kubeconfig 파일을 확인해 주세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {clusters.map((cluster) => (
            <ClusterCard key={cluster.context} cluster={cluster} />
          ))}
        </div>
      )}
    </div>
  )
}
