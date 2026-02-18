import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, ChevronUp, ChevronDown } from 'lucide-react'
import { k8sService } from '../../services/k8sService'
import type { NodeInfo } from '../../types/k8s'
import Table from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'

function formatCores(millicores: number): string {
  return `${(millicores / 1000).toFixed(0)} cores`
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const gi = bytes / (1024 ** 3)
  if (gi >= 1) return `${gi.toFixed(1)} GiB`
  const mi = bytes / (1024 ** 2)
  return `${mi.toFixed(0)} MiB`
}

function ProgressCell({ percentage, totalLabel }: { percentage: number; totalLabel: string }) {
  const color = percentage > 80 ? 'bg-danger' : percentage > 60 ? 'bg-warning' : 'bg-accent'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
      </div>
      <span className="text-xs">{percentage}% ({totalLabel})</span>
    </div>
  )
}

type SortKey = 'name' | 'status' | 'cpu' | 'memory'
type SortDir = 'asc' | 'desc'

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronUp size={12} className="text-text-tertiary opacity-30" />
  return dir === 'asc'
    ? <ChevronUp size={12} className="text-accent" />
    : <ChevronDown size={12} className="text-accent" />
}

export default function NodeList({ context }: { context: string }) {
  const [nodes, setNodes] = useState<NodeInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedNode, setExpandedNode] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const fetchNodes = async () => {
    setLoading(true)
    try {
      setNodes(await k8sService.getNodes(context))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNodes()
    const interval = setInterval(fetchNodes, 15000)
    return () => clearInterval(interval)
  }, [context])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedAndFiltered = useMemo(() => {
    let result = nodes

    // Filter
    if (search) {
      result = result.filter((n) => n.name.toLowerCase().includes(search.toLowerCase()))
    }

    // Sort
    const sorted = [...result].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'status':
          cmp = a.status.localeCompare(b.status)
          break
        case 'cpu':
          cmp = (a.cpu?.percentage ?? 0) - (b.cpu?.percentage ?? 0)
          break
        case 'memory':
          cmp = (a.memory?.percentage ?? 0) - (b.memory?.percentage ?? 0)
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return sorted
  }, [nodes, search, sortKey, sortDir])

  const headerButton = (label: string, key: SortKey) => (
    <button
      onClick={() => toggleSort(key)}
      className="inline-flex items-center gap-1 hover:text-accent"
    >
      {label}
      <SortIcon active={sortKey === key} dir={sortDir} />
    </button>
  )

  const columns = [
    {
      key: 'name',
      header: headerButton('노드명', 'name'),
      render: (n: NodeInfo) => (
        <button
          onClick={() => setExpandedNode(expandedNode === n.name ? null : n.name)}
          className="font-medium text-accent hover:underline text-left"
        >
          {n.name}
        </button>
      ),
    },
    {
      key: 'status',
      header: headerButton('상태', 'status'),
      render: (n: NodeInfo) => (
        <Badge variant={n.status === 'Ready' ? 'success' : 'danger'}>{n.status}</Badge>
      ),
    },
    {
      key: 'roles',
      header: '역할',
      render: (n: NodeInfo) => <span className="text-xs">{n.roles.join(', ')}</span>,
    },
    {
      key: 'cpu',
      header: headerButton('CPU', 'cpu'),
      render: (n: NodeInfo) => n.cpu
        ? <ProgressCell percentage={n.cpu.percentage} totalLabel={formatCores(n.cpu.total)} />
        : '-',
    },
    {
      key: 'memory',
      header: headerButton('Memory', 'memory'),
      render: (n: NodeInfo) => n.memory
        ? <ProgressCell percentage={n.memory.percentage} totalLabel={formatBytes(n.memory.total)} />
        : '-',
    },
  ]

  if (loading && nodes.length === 0) {
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
            placeholder="노드 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm bg-bg-primary text-text-primary border border-border-secondary rounded-md focus:outline-none focus:ring-1 focus:ring-accent w-48"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={fetchNodes}>
          <RefreshCw size={14} className="mr-1" />
          새로고침
        </Button>
      </div>

      <Table
        columns={columns}
        data={sortedAndFiltered}
        keyExtractor={(n) => n.name}
      />

      {expandedNode && (() => {
        const node = nodes.find((n) => n.name === expandedNode)
        if (!node) return null
        return (
          <div className="mt-3 p-4 bg-bg-secondary border border-border-primary rounded-lg text-xs">
            <h4 className="font-medium text-text-primary mb-2">Taints</h4>
            {node.taints.length === 0 ? (
              <p className="text-text-tertiary">없음</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {node.taints.map((t, i) => (
                  <Badge key={i} variant="warning">
                    {t.key}={t.value}:{t.effect}
                  </Badge>
                ))}
              </div>
            )}
            <h4 className="font-medium text-text-primary mt-3 mb-2">Labels</h4>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {Object.entries(node.labels).map(([k, v]) => (
                <Badge key={k} variant="default">
                  {k}={v}
                </Badge>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
