import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { k8sService } from '../../services/k8sService'
import type { NodeInfo } from '../../types/k8s'
import Table from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'

function ProgressCell({ percentage }: { percentage: number }) {
  const color = percentage > 80 ? 'bg-danger' : percentage > 60 ? 'bg-warning' : 'bg-accent'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
      </div>
      <span className="text-xs">{percentage}%</span>
    </div>
  )
}

export default function NodeList({ context }: { context: string }) {
  const [nodes, setNodes] = useState<NodeInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedNode, setExpandedNode] = useState<string | null>(null)

  const fetch = async () => {
    setLoading(true)
    try {
      setNodes(await k8sService.getNodes(context))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch()
    const interval = setInterval(fetch, 15000)
    return () => clearInterval(interval)
  }, [context])

  const columns = [
    {
      key: 'name',
      header: '노드명',
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
      header: '상태',
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
      header: 'CPU',
      render: (n: NodeInfo) => n.cpu ? <ProgressCell percentage={n.cpu.percentage} /> : '-',
    },
    {
      key: 'memory',
      header: 'Memory',
      render: (n: NodeInfo) => n.memory ? <ProgressCell percentage={n.memory.percentage} /> : '-',
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
      <div className="flex items-center justify-end mb-3">
        <Button variant="ghost" size="sm" onClick={fetch}>
          <RefreshCw size={14} className="mr-1" />
          새로고침
        </Button>
      </div>

      <Table
        columns={columns}
        data={nodes}
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
