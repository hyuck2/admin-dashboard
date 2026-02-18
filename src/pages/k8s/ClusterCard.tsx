import { Link } from 'react-router-dom'
import { Server, Cpu, HardDrive } from 'lucide-react'
import type { ClusterInfo } from '../../types/k8s'
import Badge from '../../components/ui/Badge'

function ProgressBar({ percentage, color }: { percentage: number; color: string }) {
  return (
    <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const gb = bytes / (1024 ** 3)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  const mb = bytes / (1024 ** 2)
  return `${mb.toFixed(0)} MB`
}

function formatCores(millicores: number): string {
  return `${(millicores / 1000).toFixed(1)} cores`
}

export default function ClusterCard({ cluster }: { cluster: ClusterInfo }) {
  const statusVariant = cluster.status === 'healthy' ? 'success' : 'danger'

  return (
    <Link
      to={`/k8s/${cluster.context}`}
      className="block p-5 bg-bg-primary border border-border-primary rounded-lg hover:border-accent/50 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent-light rounded-md">
            <Server size={20} className="text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">{cluster.name}</h3>
            <p className="text-xs text-text-tertiary truncate max-w-[200px]">{cluster.apiServer}</p>
          </div>
        </div>
        <Badge variant={statusVariant}>{cluster.status}</Badge>
      </div>

      {cluster.nodes && (
        <div className="flex items-center gap-2 mb-3 text-xs text-text-secondary">
          <Server size={12} />
          <span>Nodes: {cluster.nodes.ready}/{cluster.nodes.total} Ready</span>
        </div>
      )}

      <div className="space-y-3">
        {cluster.cpu && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1 text-text-secondary">
                <Cpu size={12} /> CPU
              </span>
              <span className="text-text-primary font-medium">
                {cluster.cpu.percentage}% ({formatCores(cluster.cpu.used)} / {formatCores(cluster.cpu.total)})
              </span>
            </div>
            <ProgressBar
              percentage={cluster.cpu.percentage}
              color={cluster.cpu.percentage > 80 ? 'bg-danger' : cluster.cpu.percentage > 60 ? 'bg-warning' : 'bg-accent'}
            />
          </div>
        )}

        {cluster.memory && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1 text-text-secondary">
                <HardDrive size={12} /> Memory
              </span>
              <span className="text-text-primary font-medium">
                {cluster.memory.percentage}% ({formatBytes(cluster.memory.used)} / {formatBytes(cluster.memory.total)})
              </span>
            </div>
            <ProgressBar
              percentage={cluster.memory.percentage}
              color={cluster.memory.percentage > 80 ? 'bg-danger' : cluster.memory.percentage > 60 ? 'bg-warning' : 'bg-accent'}
            />
          </div>
        )}
      </div>
    </Link>
  )
}
