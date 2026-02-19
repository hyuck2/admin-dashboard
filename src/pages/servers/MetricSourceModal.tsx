import { useState, useEffect } from 'react'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import type { MetricSource } from '../../types/server'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (data: { name: string; url: string; description: string }) => void
  source?: MetricSource | null
}

export default function MetricSourceModal({ open, onClose, onSubmit, source }: Props) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (source) {
      setName(source.name)
      setUrl(source.url)
      setDescription(source.description)
    } else {
      setName('')
      setUrl('')
      setDescription('')
    }
  }, [source, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ name, url, description })
  }

  const inputClass = 'w-full text-sm bg-bg-primary text-text-primary border border-border-secondary rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent'

  return (
    <Modal open={open} onClose={onClose} title={source ? '메트릭 소스 수정' : '메트릭 소스 등록'} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-text-secondary mb-1">이름 *</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">URL *</label>
          <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://prometheus:9090" required />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">설명</label>
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>취소</Button>
          <Button type="submit" size="sm">{source ? '수정' : '등록'}</Button>
        </div>
      </form>
    </Modal>
  )
}
