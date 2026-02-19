import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { metricService } from '../../services/metricService'
import type { MetricSource, MetricTarget, ServerMetrics } from '../../types/server'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import MetricsChart from './MetricsChart'

export default function MetricSourceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const sourceId = Number(id)
  const [source, setSource] = useState<MetricSource | null>(null)
  const [targets, setTargets] = useState<MetricTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIp, setSelectedIp] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [range, setRange] = useState('1h')

  const fetchData = async () => {
    setLoading(true)
    try {
      const [sources, tgts] = await Promise.all([
        metricService.getSources(),
        metricService.getTargets(sourceId),
      ])
      setSource(sources.find((s) => s.id === sourceId) || null)
      setTargets(tgts)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [sourceId])

  const fetchMetrics = async (ip: string) => {
    setMetricsLoading(true)
    try {
      const data = await metricService.getMetrics(sourceId, ip, range)
      setMetrics(data)
    } finally {
      setMetricsLoading(false)
    }
  }

  useEffect(() => {
    if (selectedIp) fetchMetrics(selectedIp)
  }, [selectedIp, range])

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>

  return (
    <div>
      <div className="flex items-center gap-1 text-sm text-text-secondary mb-4">
        <Link to="/servers?tab=metrics" className="hover:text-accent">메트릭 소스</Link>
        <ChevronRight size={14} />
        <span className="text-text-primary font-medium">{source?.name}</span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">{source?.name}</h1>
          <p className="text-xs text-text-secondary font-mono">{source?.url}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData}><RefreshCw size={14} /></Button>
      </div>

      <div className="border border-border-primary rounded-lg overflow-hidden mb-4">
        <table className="w-full text-xs">
          <thead className="bg-bg-tertiary">
            <tr>
              <th className="px-3 py-2 text-left text-text-secondary font-medium">Instance</th>
              <th className="px-3 py-2 text-left text-text-secondary font-medium">Job</th>
              <th className="px-3 py-2 text-left text-text-secondary font-medium">Health</th>
              <th className="px-3 py-2 text-left text-text-secondary font-medium">매칭 서버</th>
            </tr>
          </thead>
          <tbody>
            {targets.map((t, i) => {
              const ip = t.instance.split(':')[0]
              return (
                <tr key={i} className={`border-t border-border-primary hover:bg-bg-hover cursor-pointer ${selectedIp === ip ? 'bg-bg-hover' : ''}`} onClick={() => setSelectedIp(ip)}>
                  <td className="px-3 py-2 text-text-primary font-mono">{t.instance}</td>
                  <td className="px-3 py-2 text-text-secondary">{t.job}</td>
                  <td className="px-3 py-2">
                    <Badge variant={t.health === 'up' ? 'success' : 'danger'}>{t.health}</Badge>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{t.matchedHostname || '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selectedIp && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-primary">메트릭 — {selectedIp}</h2>
            <div className="flex items-center gap-2">
              {['1h', '6h', '24h', '7d'].map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`text-xs px-2 py-0.5 rounded ${range === r ? 'bg-accent text-text-inverse' : 'bg-bg-tertiary text-text-secondary hover:bg-bg-active'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          {metricsLoading ? (
            <div className="flex justify-center py-8"><Spinner className="h-5 w-5" /></div>
          ) : metrics ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <MetricsChart title="CPU (%)" data={metrics.cpu} color="#8b5cf6" />
              <MetricsChart title="Memory (%)" data={metrics.memory} color="#06b6d4" />
              <MetricsChart title="Disk (%)" data={metrics.disk} color="#f59e0b" />
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
