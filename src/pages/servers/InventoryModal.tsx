import { useState, useEffect } from 'react'
import { ansibleService } from '../../services/ansibleService'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import type { Inventory, ServerGroup } from '../../types/server'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (data: { name: string; groupId: number | null; content: string }) => void
  inventory?: Inventory | null
  groups: ServerGroup[]
}

export default function InventoryModal({ open, onClose, onSubmit, inventory, groups }: Props) {
  const [name, setName] = useState('')
  const [groupId, setGroupId] = useState<number | null>(null)
  const [content, setContent] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (inventory) {
      setName(inventory.name)
      setGroupId(inventory.groupId)
      setContent(inventory.content)
    } else {
      setName('')
      setGroupId(null)
      setContent('')
    }
  }, [inventory, open])

  const handleGenerate = async () => {
    if (!groupId) return
    setGenerating(true)
    try {
      const res = await ansibleService.generateInventory(groupId)
      setContent(res.content)
    } finally {
      setGenerating(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ name, groupId, content })
  }

  const inputClass = 'w-full text-sm bg-bg-primary text-text-primary border border-border-secondary rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent'

  return (
    <Modal open={open} onClose={onClose} title={inventory ? 'Inventory 수정' : 'Inventory 생성'} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">이름 *</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">그룹</label>
            <select className={inputClass} value={groupId ?? ''} onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">없음</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-text-secondary">Inventory 내용 *</label>
            <Button type="button" variant="ghost" size="sm" onClick={handleGenerate} disabled={!groupId || generating}>
              {generating ? <Spinner className="h-3 w-3 mr-1" /> : null}
              자동 생성
            </Button>
          </div>
          <textarea
            className={inputClass + ' h-48 font-mono text-xs'}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="[group_name]&#10;10.0.1.1 ansible_port=22 ansible_user=root ansible_ssh_pass=***"
            required
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>취소</Button>
          <Button type="submit" size="sm">{inventory ? '수정' : '생성'}</Button>
        </div>
      </form>
    </Modal>
  )
}
