import { useState } from 'react'
import { serverService } from '../../services/serverService'
import type { ServerGroup, GroupExecuteResult } from '../../types/server'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'

interface Props {
  group: ServerGroup
  onClose: () => void
}

export default function GroupExecuteModal({ group, onClose }: Props) {
  const [command, setCommand] = useState('')
  const [results, setResults] = useState<GroupExecuteResult[]>([])
  const [loading, setLoading] = useState(false)
  const [executed, setExecuted] = useState(false)

  const handleExecute = async () => {
    if (!command.trim()) return
    setLoading(true)
    setExecuted(false)
    try {
      const res = await serverService.groupExecute(group.id, command)
      setResults(res)
      setExecuted(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={true} onClose={onClose} title={`그룹 명령 실행 — ${group.name}`} maxWidth="max-w-4xl">
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-text-secondary mb-1">명령어</label>
          <textarea
            className="w-full text-sm bg-bg-primary text-text-primary border border-border-secondary rounded px-3 py-2 font-mono h-20 focus:outline-none focus:ring-1 focus:ring-accent"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="uptime"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>닫기</Button>
          <Button size="sm" onClick={handleExecute} disabled={loading || !command.trim()}>
            {loading ? <><Spinner className="h-3 w-3 mr-1" />실행 중...</> : '실행'}
          </Button>
        </div>

        {executed && (
          <div className="border border-border-primary rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-bg-tertiary">
                <tr>
                  <th className="px-3 py-2 text-left text-text-secondary font-medium">서버</th>
                  <th className="px-3 py-2 text-left text-text-secondary font-medium">IP</th>
                  <th className="px-3 py-2 text-left text-text-secondary font-medium">Exit</th>
                  <th className="px-3 py-2 text-left text-text-secondary font-medium">stdout</th>
                  <th className="px-3 py-2 text-left text-text-secondary font-medium">stderr</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.serverId} className="border-t border-border-primary">
                    <td className="px-3 py-2 text-text-primary">{r.hostname}</td>
                    <td className="px-3 py-2 text-text-secondary font-mono">{r.ipAddress}</td>
                    <td className="px-3 py-2">
                      <Badge variant={r.exitCode === 0 ? 'success' : 'danger'}>{r.exitCode}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <pre className="whitespace-pre-wrap text-text-primary font-mono max-h-20 overflow-y-auto">{r.stdout || '-'}</pre>
                    </td>
                    <td className="px-3 py-2">
                      <pre className="whitespace-pre-wrap text-danger font-mono max-h-20 overflow-y-auto">{r.stderr || '-'}</pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  )
}
