import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Wifi, RefreshCw } from 'lucide-react'
import { metricService } from '../../services/metricService'
import type { MetricSource } from '../../types/server'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import MetricSourceModal from './MetricSourceModal'

export default function MetricSourcesTab() {
  const navigate = useNavigate()
  const [sources, setSources] = useState<MetricSource[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editSource, setEditSource] = useState<MetricSource | null>(null)
  const [testingId, setTestingId] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<Record<number, { ok: boolean; msg: string }>>({})

  const fetchSources = async () => {
    setLoading(true)
    try {
      const data = await metricService.getSources()
      setSources(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSources() }, [])

  const handleCreate = async (data: { name: string; url: string; description: string }) => {
    await metricService.createSource(data)
    setModalOpen(false)
    fetchSources()
  }

  const handleUpdate = async (data: { name: string; url: string; description: string }) => {
    if (!editSource) return
    await metricService.updateSource(editSource.id, data)
    setEditSource(null)
    fetchSources()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('메트릭 소스를 삭제하시겠습니까?')) return
    await metricService.deleteSource(id)
    fetchSources()
  }

  const handleTest = async (id: number) => {
    setTestingId(id)
    try {
      await metricService.testSource(id)
      setTestResult((prev) => ({ ...prev, [id]: { ok: true, msg: '연결 성공' } }))
    } catch (e) {
      setTestResult((prev) => ({ ...prev, [id]: { ok: false, msg: e instanceof Error ? e.message : '연결 실패' } }))
    } finally {
      setTestingId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">메트릭 소스 (Prometheus / VictoriaMetrics)</span>
          {loading && <Spinner className="h-4 w-4" />}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus size={14} className="mr-1" />소스 등록
          </Button>
          <Button variant="ghost" size="sm" onClick={fetchSources}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      <div className="border border-border-primary rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-bg-tertiary">
            <tr>
              <th className="px-3 py-2 text-left text-text-secondary font-medium">이름</th>
              <th className="px-3 py-2 text-left text-text-secondary font-medium">URL</th>
              <th className="px-3 py-2 text-left text-text-secondary font-medium">상태</th>
              <th className="px-3 py-2 text-left text-text-secondary font-medium">테스트</th>
              <th className="px-3 py-2 text-right text-text-secondary font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} className="border-t border-border-primary hover:bg-bg-hover cursor-pointer" onClick={() => navigate(`/servers/prometheus/${s.id}`)}>
                <td className="px-3 py-2 text-text-primary font-medium">{s.name}</td>
                <td className="px-3 py-2 text-text-secondary font-mono text-xs">{s.url}</td>
                <td className="px-3 py-2">
                  <Badge variant={s.isActive ? 'success' : 'default'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
                </td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  {testingId === s.id ? (
                    <Spinner className="h-3 w-3" />
                  ) : testResult[s.id] ? (
                    <Badge variant={testResult[s.id].ok ? 'success' : 'danger'}>{testResult[s.id].msg}</Badge>
                  ) : (
                    <button onClick={() => handleTest(s.id)} className="text-accent hover:underline text-xs">테스트</button>
                  )}
                </td>
                <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleTest(s.id)} className="p-1 rounded hover:bg-bg-active text-text-tertiary" title="테스트">
                      <Wifi size={13} />
                    </button>
                    <button onClick={() => setEditSource(s)} className="p-1 rounded hover:bg-bg-active text-text-tertiary" title="편집">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="p-1 rounded hover:bg-bg-active text-danger" title="삭제">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sources.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-text-tertiary">등록된 메트릭 소스가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <MetricSourceModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreate} />
      <MetricSourceModal open={!!editSource} onClose={() => setEditSource(null)} onSubmit={handleUpdate} source={editSource} />
    </div>
  )
}
