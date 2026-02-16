import { useState, type FormEvent } from 'react'
import { userService } from '../../services/userService'
import type { Group, Permission } from '../../types/user'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { toast } from '../../components/ui/Toast'

interface GroupModalProps {
  group: Group | null
  permissions: Permission[]
  onClose: () => void
  onComplete: () => void
}

function permissionLabel(p: Permission): string {
  const typeLabel = p.type === 'app_deploy' ? '앱 배포' : '페이지 접근'
  const actionLabel = p.action === 'write' ? '쓰기' : '읽기'
  return `${typeLabel} - ${p.target} (${actionLabel})`
}

export default function GroupModal({ group, permissions, onClose, onComplete }: GroupModalProps) {
  const isEdit = !!group
  const [name, setName] = useState(group?.name ?? '')
  const [description, setDescription] = useState(group?.description ?? '')
  const [selectedPerms, setSelectedPerms] = useState<number[]>(group?.permissions ?? [])
  const [loading, setLoading] = useState(false)

  const togglePerm = (permId: number) => {
    setSelectedPerms((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId],
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (isEdit) {
        await userService.updateGroup(group.id, { name, description, permissions: selectedPerms })
        toast('success', `${name} 그룹이 수정되었습니다.`)
      } else {
        await userService.createGroup({ name, description, permissions: selectedPerms })
        toast('success', `${name} 그룹이 추가되었습니다.`)
      }
      onComplete()
      onClose()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : '처리에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? '그룹 수정' : '그룹 추가'} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="그룹명"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="설명"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">권한 할당</label>
          <div className="space-y-1 max-h-48 overflow-y-auto border border-border-secondary rounded-md p-2">
            {permissions.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedPerms.includes(p.id)}
                  onChange={() => togglePerm(p.id)}
                  className="rounded"
                />
                {permissionLabel(p)}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>취소</Button>
          <Button type="submit" disabled={loading}>
            {loading ? '처리 중...' : isEdit ? '수정' : '추가'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
