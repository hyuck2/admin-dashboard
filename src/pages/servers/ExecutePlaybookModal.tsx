import { useState } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import type { Playbook, Inventory } from '../../types/server'

interface Props {
  open: boolean
  onClose: () => void
  playbooks: Playbook[]
  inventories: Inventory[]
  onExecute: (playbookId: number, inventoryId: number) => void
}

export default function ExecutePlaybookModal({ open, onClose, playbooks, inventories, onExecute }: Props) {
  const [playbookId, setPlaybookId] = useState<number>(0)
  const [inventoryId, setInventoryId] = useState<number>(0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (playbookId && inventoryId) {
      onExecute(playbookId, inventoryId)
    }
  }

  const inputClass = 'w-full text-sm bg-bg-primary text-text-primary border border-border-secondary rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent'

  return (
    <Modal open={open} onClose={onClose} title="Playbook 실행">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-text-secondary mb-1">Playbook *</label>
          <select className={inputClass} value={playbookId} onChange={(e) => setPlaybookId(Number(e.target.value))} required>
            <option value={0}>선택...</option>
            {playbooks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Inventory *</label>
          <select className={inputClass} value={inventoryId} onChange={(e) => setInventoryId(Number(e.target.value))} required>
            <option value={0}>선택...</option>
            {inventories.map((inv) => <option key={inv.id} value={inv.id}>{inv.name}{inv.groupName ? ` (${inv.groupName})` : ''}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>취소</Button>
          <Button type="submit" size="sm" disabled={!playbookId || !inventoryId}>실행</Button>
        </div>
      </form>
    </Modal>
  )
}
