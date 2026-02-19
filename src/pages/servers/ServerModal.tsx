import { useState, useEffect } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import type { Server, ServerGroup } from '../../types/server'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (data: {
    hostname: string
    ipAddress: string
    sshPort: number
    sshUsername: string
    sshPassword: string
    osInfo: string
    description: string
    groupId: number | null
  }) => void
  server?: Server | null
  groups: ServerGroup[]
}

export default function ServerModal({ open, onClose, onSubmit, server, groups }: Props) {
  const [hostname, setHostname] = useState('')
  const [ipAddress, setIpAddress] = useState('')
  const [sshPort, setSshPort] = useState(22)
  const [sshUsername, setSshUsername] = useState('root')
  const [sshPassword, setSshPassword] = useState('')
  const [osInfo, setOsInfo] = useState('')
  const [description, setDescription] = useState('')
  const [groupId, setGroupId] = useState<number | null>(null)

  useEffect(() => {
    if (server) {
      setHostname(server.hostname)
      setIpAddress(server.ipAddress)
      setSshPort(server.sshPort)
      setSshUsername(server.sshUsername)
      setSshPassword('')
      setOsInfo(server.osInfo)
      setDescription(server.description)
      setGroupId(server.groupId)
    } else {
      setHostname('')
      setIpAddress('')
      setSshPort(22)
      setSshUsername('root')
      setSshPassword('')
      setOsInfo('')
      setDescription('')
      setGroupId(null)
    }
  }, [server, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ hostname, ipAddress, sshPort, sshUsername, sshPassword, osInfo, description, groupId })
  }

  const inputClass = 'w-full text-sm bg-bg-primary text-text-primary border border-border-secondary rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent'

  return (
    <Modal open={open} onClose={onClose} title={server ? '서버 수정' : '서버 등록'} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">호스트명 *</label>
            <input className={inputClass} value={hostname} onChange={(e) => setHostname(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">IP 주소 *</label>
            <input className={inputClass} value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">SSH 포트</label>
            <input type="number" className={inputClass} value={sshPort} onChange={(e) => setSshPort(Number(e.target.value))} min={1} max={65535} />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">SSH 사용자</label>
            <input className={inputClass} value={sshUsername} onChange={(e) => setSshUsername(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-text-secondary mb-1">SSH 비밀번호 {server ? '(변경 시만 입력)' : '*'}</label>
            <input type="password" className={inputClass} value={sshPassword} onChange={(e) => setSshPassword(e.target.value)} required={!server} />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">그룹</label>
            <select className={inputClass} value={groupId ?? ''} onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">없음</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">OS 정보</label>
            <input className={inputClass} value={osInfo} onChange={(e) => setOsInfo(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-text-secondary mb-1">설명</label>
            <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>취소</Button>
          <Button type="submit" size="sm">{server ? '수정' : '등록'}</Button>
        </div>
      </form>
    </Modal>
  )
}
