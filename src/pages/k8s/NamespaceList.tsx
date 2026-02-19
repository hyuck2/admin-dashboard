import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Search } from 'lucide-react'
import { k8sService } from '../../services/k8sService'
import type { NamespaceInfo } from '../../types/k8s'
import Table from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const mb = bytes / (1024 ** 2)
  if (mb < 1024) return `${mb.toFixed(0)} Mi`
  return `${(mb / 1024).toFixed(1)} Gi`
}

export default function NamespaceList({ context }: { context: string }) {
  const [namespaces, setNamespaces] = useState<NamespaceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetch = async () => {
    setLoading(true)
    try {
      setNamespaces(await k8sService.getNamespaces(context))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch()
    const interval = setInterval(fetch, 15000)
    return () => clearInterval(interval)
  }, [context])

  const filtered = useMemo(() => {
    if (!search) return namespaces
    return namespaces.filter((ns) => ns.name.toLowerCase().includes(search.toLowerCase()))
  }, [namespaces, search])

  const columns = [
    {
      key: 'name',
      header: '네임스페이스',
      render: (ns: NamespaceInfo) => (
        <Link
          to={`/k8s/${context}?tab=deployments&ns=${encodeURIComponent(ns.name)}`}
          className="font-medium text-accent hover:underline"
        >
          {ns.name}
        </Link>
      ),
    },
    {
      key: 'status',
      header: '상태',
      render: (ns: NamespaceInfo) => (
        <Badge variant={ns.status === 'Active' ? 'success' : 'warning'}>{ns.status}</Badge>
      ),
    },
    {
      key: 'pods',
      header: 'Pods',
      render: (ns: NamespaceInfo) => ns.podCount,
    },
    {
      key: 'cpu',
      header: 'CPU (cores)',
      render: (ns: NamespaceInfo) => ns.cpuUsage > 0 ? ns.cpuUsage.toFixed(3) : '-',
    },
    {
      key: 'memory',
      header: 'Memory',
      render: (ns: NamespaceInfo) => ns.memoryUsage > 0 ? formatBytes(ns.memoryUsage) : '-',
    },
  ]

  if (loading && namespaces.length === 0) {
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
            placeholder="네임스페이스 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm bg-bg-primary text-text-primary border border-border-secondary rounded-md focus:outline-none focus:ring-1 focus:ring-accent w-48"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={fetch}>
          <RefreshCw size={14} className="mr-1" />
          새로고침
        </Button>
      </div>

      <Table
        columns={columns}
        data={filtered}
        keyExtractor={(ns) => ns.name}
      />
    </div>
  )
}
