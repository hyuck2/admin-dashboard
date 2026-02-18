import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { k8sService } from '../../services/k8sService'
import type { DeploymentInfo } from '../../types/k8s'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'

export default function DeploymentDetailPage() {
  const { context, namespace, name } = useParams<{ context: string; namespace: string; name: string }>()
  const [deploy, setDeploy] = useState<DeploymentInfo | null>(null)
  const [describe, setDescribe] = useState('')
  const [loading, setLoading] = useState(true)

  if (!context || !namespace || !name) return null

  const fetch = async () => {
    setLoading(true)
    try {
      const [d, desc] = await Promise.all([
        k8sService.getDeployment(context, namespace, name),
        k8sService.describeDeployment(context, namespace, name),
      ])
      setDeploy(d)
      setDescribe(desc.describe)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch() }, [context, namespace, name])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  if (!deploy) return <p className="text-text-secondary text-sm">Deployment을 찾을 수 없습니다.</p>

  return (
    <div>
      <div className="flex items-center gap-1 text-sm text-text-secondary mb-4">
        <Link to="/k8s" className="hover:text-accent">K8s 클러스터</Link>
        <ChevronRight size={14} />
        <Link to={`/k8s/${context}`} className="hover:text-accent">{context}</Link>
        <ChevronRight size={14} />
        <Link to={`/k8s/${context}/${namespace}`} className="hover:text-accent">{namespace}</Link>
        <ChevronRight size={14} />
        <span className="text-text-primary font-medium">{name}</span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-text-primary">{name}</h1>
          <Badge variant={deploy.status === 'Running' ? 'success' : 'warning'}>{deploy.status}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={fetch}>
          <RefreshCw size={14} className="mr-1" />
          새로고침
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <InfoCard label="Namespace" value={deploy.namespace} />
        <InfoCard label="Replicas" value={`${deploy.readyReplicas}/${deploy.replicas}`} />
        <InfoCard label="Image" value={deploy.image || '-'} />
        <InfoCard label="Created" value={deploy.createdAt ? new Date(deploy.createdAt).toLocaleString('ko-KR') : '-'} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-2">Describe</h2>
        <pre className="p-4 bg-bg-secondary border border-border-primary rounded-lg text-xs text-text-secondary overflow-x-auto whitespace-pre-wrap max-h-[500px] overflow-y-auto">
          {describe || 'No describe data'}
        </pre>
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-bg-secondary border border-border-primary rounded-lg">
      <p className="text-xs text-text-tertiary mb-1">{label}</p>
      <p className="text-sm text-text-primary font-medium truncate">{value}</p>
    </div>
  )
}
