import { useState, useEffect } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import type { Playbook } from '../../types/server'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (data: { name: string; description: string; content: string }) => void
  playbook?: Playbook | null
}

export default function PlaybookModal({ open, onClose, onSubmit, playbook }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')

  useEffect(() => {
    if (playbook) {
      setName(playbook.name)
      setDescription(playbook.description)
      setContent(playbook.content)
    } else {
      setName('')
      setDescription('')
      setContent('---\n- hosts: all\n  tasks:\n    - name: Example task\n      command: uptime\n')
    }
  }, [playbook, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ name, description, content })
  }

  const inputClass = 'w-full text-sm bg-bg-primary text-text-primary border border-border-secondary rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent'

  return (
    <Modal open={open} onClose={onClose} title={playbook ? 'Playbook 수정' : 'Playbook 생성'} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-text-secondary mb-1">이름 *</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">설명</label>
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Playbook YAML *</label>
          <textarea
            className={inputClass + ' h-64 font-mono text-xs'}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>취소</Button>
          <Button type="submit" size="sm">{playbook ? '수정' : '생성'}</Button>
        </div>
      </form>
    </Modal>
  )
}
