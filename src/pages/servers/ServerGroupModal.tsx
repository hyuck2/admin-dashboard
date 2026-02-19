import { useState, useEffect } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import type { ServerGroup } from '../../types/server'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (data: { name: string; description: string }) => void
  group?: ServerGroup | null
}

export default function ServerGroupModal({ open, onClose, onSubmit, group }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (group) {
      setName(group.name)
      setDescription(group.description)
    } else {
      setName('')
      setDescription('')
    }
  }, [group, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ name, description })
  }

  const inputClass = 'w-full text-sm bg-bg-primary text-text-primary border border-border-secondary rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent'

  return (
    <Modal open={open} onClose={onClose} title={group ? '그룹 수정' : '그룹 생성'}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-text-secondary mb-1">그룹명 *</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">설명</label>
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>취소</Button>
          <Button type="submit" size="sm">{group ? '수정' : '생성'}</Button>
        </div>
      </form>
    </Modal>
  )
}
