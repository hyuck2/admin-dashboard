import { useState } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import type { ServerGroup, CreateServerRequest } from '../../types/server'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (servers: CreateServerRequest[]) => void
  groups: ServerGroup[]
}

interface ParsedRow {
  hostname: string
  ipAddress: string
  sshPort: number
  sshUsername: string
  sshPassword: string
}

export default function BulkServerModal({ open, onClose, onSubmit, groups }: Props) {
  const [rawText, setRawText] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [groupId, setGroupId] = useState<number | null>(null)
  const [parsed, setParsed] = useState(false)

  const parseText = () => {
    if (!rawText.trim()) return
    const lines = rawText.trim().split('\n')
    const isTsv = lines[0].includes('\t')
    const sep = isTsv ? '\t' : ','

    const headerLine = lines[0].toLowerCase()
    const headers = headerLine.split(sep).map((h) => h.trim())

    const colMap: Record<string, number> = {}
    headers.forEach((h, i) => {
      if (h.includes('hostname') || h.includes('호스트')) colMap.hostname = i
      else if (h.includes('ip') || h.includes('address') || h.includes('주소')) colMap.ip = i
      else if (h.includes('port') || h.includes('포트')) colMap.port = i
      else if (h.includes('user') || h.includes('사용자')) colMap.user = i
      else if (h.includes('pass') || h.includes('비밀번호')) colMap.password = i
    })

    // If no headers matched, treat first line as data
    const dataStart = Object.keys(colMap).length > 0 ? 1 : 0
    if (dataStart === 0) {
      // Assume columns: hostname, ip, port, user, password
      colMap.hostname = 0
      colMap.ip = 1
      colMap.port = 2
      colMap.user = 3
      colMap.password = 4
    }

    const parsed: ParsedRow[] = []
    for (let i = dataStart; i < lines.length; i++) {
      const cols = lines[i].split(sep).map((c) => c.trim())
      if (cols.length < 2) continue
      parsed.push({
        hostname: cols[colMap.hostname] || '',
        ipAddress: cols[colMap.ip] || '',
        sshPort: Number(cols[colMap.port]) || 22,
        sshUsername: cols[colMap.user] || 'root',
        sshPassword: cols[colMap.password] || '',
      })
    }
    setRows(parsed)
    setParsed(true)
  }

  const updateRow = (idx: number, field: keyof ParsedRow, value: string | number) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  const addRow = () => {
    setRows((prev) => [...prev, { hostname: '', ipAddress: '', sshPort: 22, sshUsername: 'root', sshPassword: '' }])
  }

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = () => {
    const servers: CreateServerRequest[] = rows
      .filter((r) => r.hostname && r.ipAddress)
      .map((r) => ({
        hostname: r.hostname,
        ipAddress: r.ipAddress,
        sshPort: r.sshPort,
        sshUsername: r.sshUsername,
        sshPassword: r.sshPassword,
        groupId,
      }))
    onSubmit(servers)
  }

  const handleClose = () => {
    setRawText('')
    setRows([])
    setParsed(false)
    setGroupId(null)
    onClose()
  }

  const inputClass = 'w-full text-xs bg-bg-primary text-text-primary border border-border-secondary rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent'

  return (
    <Modal open={open} onClose={handleClose} title="대량 서버 등록" maxWidth="max-w-4xl">
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-text-secondary mb-1">그룹</label>
          <select className={inputClass + ' max-w-xs'} value={groupId ?? ''} onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">없음</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        {!parsed ? (
          <>
            <div>
              <label className="block text-xs text-text-secondary mb-1">서버 데이터를 붙여넣으세요 (TSV/CSV):</label>
              <textarea
                className={inputClass + ' h-32 font-mono'}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={'hostname\tip\tport\tuser\tpassword\ndev-server-1\t10.0.1.1\t22\troot\tpassword123'}
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={parseText} disabled={!rawText.trim()}>파싱</Button>
            </div>
          </>
        ) : (
          <>
            <div className="overflow-x-auto max-h-80 overflow-y-auto border border-border-secondary rounded">
              <table className="w-full text-xs">
                <thead className="bg-bg-tertiary sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-text-secondary">#</th>
                    <th className="px-2 py-1.5 text-left text-text-secondary">hostname</th>
                    <th className="px-2 py-1.5 text-left text-text-secondary">IP</th>
                    <th className="px-2 py-1.5 text-left text-text-secondary">port</th>
                    <th className="px-2 py-1.5 text-left text-text-secondary">user</th>
                    <th className="px-2 py-1.5 text-left text-text-secondary">password</th>
                    <th className="px-2 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} className="border-t border-border-primary">
                      <td className="px-2 py-1 text-text-tertiary">{idx + 1}</td>
                      <td className="px-1 py-1"><input className={inputClass} value={row.hostname} onChange={(e) => updateRow(idx, 'hostname', e.target.value)} /></td>
                      <td className="px-1 py-1"><input className={inputClass} value={row.ipAddress} onChange={(e) => updateRow(idx, 'ipAddress', e.target.value)} /></td>
                      <td className="px-1 py-1"><input type="number" className={inputClass + ' w-16'} value={row.sshPort} onChange={(e) => updateRow(idx, 'sshPort', Number(e.target.value))} /></td>
                      <td className="px-1 py-1"><input className={inputClass} value={row.sshUsername} onChange={(e) => updateRow(idx, 'sshUsername', e.target.value)} /></td>
                      <td className="px-1 py-1"><input type="password" className={inputClass} value={row.sshPassword} onChange={(e) => updateRow(idx, 'sshPassword', e.target.value)} /></td>
                      <td className="px-1 py-1">
                        <button onClick={() => removeRow(idx)} className="text-danger hover:text-danger-hover text-xs">&times;</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between">
              <Button size="sm" variant="ghost" onClick={addRow}>+ 행 추가</Button>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setParsed(false)}>다시 입력</Button>
                <Button size="sm" variant="secondary" onClick={handleClose}>취소</Button>
                <Button size="sm" onClick={handleSubmit} disabled={rows.filter((r) => r.hostname && r.ipAddress).length === 0}>
                  전체 등록 ({rows.filter((r) => r.hostname && r.ipAddress).length})
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
