import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { ansibleService } from '../../services/ansibleService'
import type { AnsibleExecution } from '../../types/server'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'

export default function AnsibleExecutionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const execId = Number(id)
  const [execution, setExecution] = useState<AnsibleExecution | null>(null)
  const [loading, setLoading] = useState(true)
  const [liveLog, setLiveLog] = useState('')
  const logRef = useRef<HTMLPreElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const fetchExecution = async () => {
    setLoading(true)
    try {
      const data = await ansibleService.getExecution(execId)
      setExecution(data)
      if (data.log) setLiveLog(data.log)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExecution()
  }, [execId])

  // WebSocket for live log streaming
  useEffect(() => {
    if (!execution || execution.status !== 'running') return

    const token = localStorage.getItem('token') || ''
    const { protocol, host, pathname } = window.location
    const wsProto = protocol === 'https:' ? 'wss:' : 'ws:'
    const match = pathname.match(/^(\/[^/]+\/[^/]+)/)
    const basePath = match ? `${match[1]}/api` : '/api'
    const wsUrl = `${wsProto}//${host}${basePath}/ws/ansible?executionId=${execId}&token=${encodeURIComponent(token)}`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onmessage = (ev) => {
      setLiveLog((prev) => prev + ev.data)
    }
    ws.onclose = () => {
      fetchExecution()
    }

    return () => {
      ws.close()
    }
  }, [execution?.status])

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [liveLog])

  const statusBadge = (status: string) => {
    if (status === 'success') return <Badge variant="success">Success</Badge>
    if (status === 'failed') return <Badge variant="danger">Failed</Badge>
    if (status === 'running') return <Badge variant="warning">Running</Badge>
    return <Badge variant="default">{status}</Badge>
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>
  if (!execution) return <div className="text-center py-20 text-text-tertiary">실행 이력을 찾을 수 없습니다.</div>

  return (
    <div>
      <div className="flex items-center gap-1 text-sm text-text-secondary mb-4">
        <Link to="/servers?tab=ansible" className="hover:text-accent">Ansible</Link>
        <ChevronRight size={14} />
        <span className="text-text-primary font-medium">실행 #{execution.id}</span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            실행 #{execution.id} {statusBadge(execution.status)}
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Playbook: {execution.playbookName} | 실행자: {execution.startedByName} | 시작: {new Date(execution.startedAt).toLocaleString()}
            {execution.finishedAt && ` | 완료: ${new Date(execution.finishedAt).toLocaleString()}`}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchExecution}><RefreshCw size={14} /></Button>
      </div>

      <div className="border border-border-primary rounded-lg bg-[#1e1e2e] p-4">
        <pre
          ref={logRef}
          className="text-xs text-[#cdd6f4] font-mono whitespace-pre-wrap max-h-[60vh] overflow-y-auto"
        >
          {liveLog || '로그가 아직 없습니다...'}
          {execution.status === 'running' && <span className="animate-pulse">_</span>}
        </pre>
      </div>
    </div>
  )
}
