import { useState } from 'react'
import { ClipboardPaste, Download, Plus, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { serverService } from '../../services/serverService'
import type { ServerGroup, CreateServerRequest } from '../../types/server'

interface Props {
  open: boolean
  onClose: () => void
  onComplete: () => void
  groups: ServerGroup[]
}

type RowStatus = 'idle' | 'loading' | 'success' | 'error'

interface ParsedRow {
  hostname: string
  ipAddress: string
  sshPort: number
  sshUsername: string
  sshPassword: string
  status: RowStatus
  message: string
}

function parseClipboardText(text: string): ParsedRow[] {
  const lines = text.trim().split('\n')
  if (lines.length === 0) return []

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

  const hasHeader = Object.keys(colMap).length >= 2
  const dataStart = hasHeader ? 1 : 0
  if (!hasHeader) {
    colMap.hostname = 0
    colMap.ip = 1
    colMap.port = 2
    colMap.user = 3
    colMap.password = 4
  }

  const rows: ParsedRow[] = []
  for (let i = dataStart; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.trim())
    if (cols.length < 2 || !cols[colMap.ip ?? 1]) continue
    rows.push({
      hostname: cols[colMap.hostname] || '',
      ipAddress: cols[colMap.ip] || '',
      sshPort: Number(cols[colMap.port]) || 22,
      sshUsername: cols[colMap.user] || 'root',
      sshPassword: cols[colMap.password] || '',
      status: 'idle',
      message: '',
    })
  }
  return rows
}

export default function BulkServerModal({ open, onClose, onComplete, groups }: Props) {
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [groupId, setGroupId] = useState<number | null>(null)
  const [registering, setRegistering] = useState(false)

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) {
        alert('클립보드가 비어있습니다.')
        return
      }
      const parsed = parseClipboardText(text)
      if (parsed.length === 0) {
        alert('파싱 가능한 데이터가 없습니다.')
        return
      }
      setRows(parsed)
    } catch {
      alert('클립보드 접근 권한이 필요합니다.\n브라우저 설정에서 클립보드 권한을 허용해주세요.')
    }
  }

  const downloadCsvTemplate = () => {
    const csv = 'hostname,ip,port,user,password\ndev-server-1,10.0.1.1,22,root,mypassword\ndev-server-2,10.0.1.2,2222,testuser,testpass\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'server_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const updateRow = (idx: number, field: keyof ParsedRow, value: string | number) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value, status: 'idle' as RowStatus, message: '' } : r))
  }

  const addRow = () => {
    setRows((prev) => [...prev, { hostname: '', ipAddress: '', sshPort: 22, sshUsername: 'root', sshPassword: '', status: 'idle', message: '' }])
  }

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleRegisterAll = async () => {
    setRegistering(true)

    // Mark all valid rows as loading
    setRows((prev) => prev.map((r) =>
      r.hostname && r.ipAddress
        ? { ...r, status: 'loading' as RowStatus, message: '' }
        : { ...r, status: 'error' as RowStatus, message: 'hostname, IP 필수' }
    ))

    // Register one by one for individual status
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row.hostname || !row.ipAddress) continue

      try {
        const req: CreateServerRequest = {
          hostname: row.hostname,
          ipAddress: row.ipAddress,
          sshPort: row.sshPort,
          sshUsername: row.sshUsername,
          sshPassword: row.sshPassword,
          groupId,
        }
        await serverService.createServer(req)
        setRows((prev) => prev.map((r, j) => j === i ? { ...r, status: 'success' as RowStatus, message: '등록 완료' } : r))
      } catch (e) {
        const msg = e instanceof Error ? e.message : '등록 실패'
        setRows((prev) => prev.map((r, j) => j === i ? { ...r, status: 'error' as RowStatus, message: msg } : r))
      }
    }

    setRegistering(false)
    onComplete()
  }

  const handleClose = () => {
    setRows([])
    setGroupId(null)
    setRegistering(false)
    onClose()
  }

  const validCount = rows.filter((r) => r.hostname && r.ipAddress).length
  const successCount = rows.filter((r) => r.status === 'success').length
  const errorCount = rows.filter((r) => r.status === 'error').length
  const hasResults = successCount > 0 || errorCount > 0

  const inputClass = 'w-full text-xs bg-bg-primary text-text-primary border border-border-secondary rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent'

  return (
    <Modal open={open} onClose={handleClose} title="대량 서버 등록" maxWidth="max-w-5xl">
      <div className="space-y-3">
        {/* Top controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-secondary">그룹:</label>
            <select className={inputClass + ' w-40'} value={groupId ?? ''} onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">없음</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={downloadCsvTemplate}>
              <Download size={13} className="mr-1" />CSV 양식
            </Button>
            <Button variant="secondary" size="sm" onClick={handlePaste}>
              <ClipboardPaste size={13} className="mr-1" />붙여넣기
            </Button>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="border-2 border-dashed border-border-secondary rounded-lg py-12 text-center">
            <ClipboardPaste size={32} className="mx-auto mb-3 text-text-tertiary" />
            <p className="text-sm text-text-secondary mb-1">클립보드에 서버 데이터를 복사한 후</p>
            <p className="text-sm text-text-secondary mb-3"><strong>붙여넣기</strong> 버튼을 눌러주세요</p>
            <p className="text-xs text-text-tertiary">TSV/CSV 형식 자동 감지 (hostname, ip, port, user, password)</p>
            <div className="mt-4">
              <Button variant="ghost" size="sm" onClick={downloadCsvTemplate}>
                <Download size={13} className="mr-1" />CSV 양식 다운로드
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Results summary */}
            {hasResults && (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-text-secondary">결과:</span>
                <span className="text-success flex items-center gap-1"><CheckCircle size={12} /> {successCount}건 성공</span>
                {errorCount > 0 && <span className="text-danger flex items-center gap-1"><XCircle size={12} /> {errorCount}건 실패</span>}
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto max-h-80 overflow-y-auto border border-border-secondary rounded">
              <table className="w-full text-xs">
                <thead className="bg-bg-tertiary sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-text-secondary w-8">#</th>
                    <th className="px-2 py-1.5 text-left text-text-secondary">hostname</th>
                    <th className="px-2 py-1.5 text-left text-text-secondary">IP</th>
                    <th className="px-2 py-1.5 text-left text-text-secondary w-16">port</th>
                    <th className="px-2 py-1.5 text-left text-text-secondary">user</th>
                    <th className="px-2 py-1.5 text-left text-text-secondary">password</th>
                    <th className="px-2 py-1.5 text-left text-text-secondary w-36">상태</th>
                    <th className="px-2 py-1.5 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} className={`border-t border-border-primary ${row.status === 'success' ? 'bg-success-light/30' : row.status === 'error' ? 'bg-danger-light/30' : ''}`}>
                      <td className="px-2 py-1 text-text-tertiary">{idx + 1}</td>
                      <td className="px-1 py-1">
                        <input className={inputClass} value={row.hostname} onChange={(e) => updateRow(idx, 'hostname', e.target.value)} disabled={row.status === 'success'} />
                      </td>
                      <td className="px-1 py-1">
                        <input className={inputClass} value={row.ipAddress} onChange={(e) => updateRow(idx, 'ipAddress', e.target.value)} disabled={row.status === 'success'} />
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" className={inputClass} value={row.sshPort} onChange={(e) => updateRow(idx, 'sshPort', Number(e.target.value))} disabled={row.status === 'success'} />
                      </td>
                      <td className="px-1 py-1">
                        <input className={inputClass} value={row.sshUsername} onChange={(e) => updateRow(idx, 'sshUsername', e.target.value)} disabled={row.status === 'success'} />
                      </td>
                      <td className="px-1 py-1">
                        <input type="password" className={inputClass} value={row.sshPassword} onChange={(e) => updateRow(idx, 'sshPassword', e.target.value)} disabled={row.status === 'success'} />
                      </td>
                      <td className="px-2 py-1">
                        {row.status === 'loading' && (
                          <span className="flex items-center gap-1 text-warning"><Loader2 size={12} className="animate-spin" />등록 중...</span>
                        )}
                        {row.status === 'success' && (
                          <span className="flex items-center gap-1 text-success"><CheckCircle size={12} />완료</span>
                        )}
                        {row.status === 'error' && (
                          <span className="flex items-center gap-1 text-danger" title={row.message}><XCircle size={12} />{row.message.length > 15 ? row.message.slice(0, 15) + '...' : row.message}</span>
                        )}
                        {row.status === 'idle' && (
                          <span className="text-text-tertiary">-</span>
                        )}
                      </td>
                      <td className="px-1 py-1">
                        {row.status !== 'success' && (
                          <button onClick={() => removeRow(idx)} className="text-danger hover:text-danger-hover text-sm">&times;</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom controls */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={addRow} disabled={registering}>
                  <Plus size={13} className="mr-1" />행 추가
                </Button>
                <Button size="sm" variant="ghost" onClick={handlePaste} disabled={registering}>
                  <ClipboardPaste size={13} className="mr-1" />다시 붙여넣기
                </Button>
              </div>
              <div className="flex gap-2 items-center">
                {hasResults && <span className="text-xs text-text-tertiary">{successCount}/{rows.length} 등록 완료</span>}
                <Button size="sm" variant="secondary" onClick={handleClose}>닫기</Button>
                <Button size="sm" onClick={handleRegisterAll} disabled={registering || validCount === 0 || successCount === rows.length}>
                  {registering ? '등록 중...' : `전체 등록 (${validCount - successCount})`}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
