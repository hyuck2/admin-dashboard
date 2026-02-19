import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Search } from 'lucide-react'
import { k8sService } from '../../services/k8sService'
import type { DeploymentInfo } from '../../types/k8s'
import Table from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'

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

export default function AllDeploymentList({ context }: { context: string }) {
  const [deployments, setDeployments] = useState<DeploymentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

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
        <Link
          to={`/k8s/${context}/${d.namespace}`}
          className="text-xs text-text-secondary hover:text-accent"
        >
          {d.namespace}
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
    </div>
  )
}
