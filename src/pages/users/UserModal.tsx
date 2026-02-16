import { useState, type FormEvent } from 'react'
import { userService } from '../../services/userService'
import type { User } from '../../types/auth'
import type { Group } from '../../types/user'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import { toast } from '../../components/ui/Toast'

interface UserModalProps {
  user: User | null
  groups: Group[]
  onClose: () => void
  onComplete: () => void
}

export default function UserModal({ user, groups, onClose, onComplete }: UserModalProps) {
  const isEdit = !!user
  const [userId, setUserId] = useState(user?.userId ?? '')
  const [password, setPassword] = useState('')
  const [department, setDepartment] = useState(user?.department ?? '')
  const [role, setRole] = useState<'admin' | 'user'>(user?.role ?? 'user')
  const [selectedGroups, setSelectedGroups] = useState<number[]>(user?.groups ?? [])
  const [loading, setLoading] = useState(false)

  const toggleGroup = (groupId: number) => {
    setSelectedGroups((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (isEdit) {
        await userService.updateUser(user.id, { department, role, groups: selectedGroups })
        toast('success', `${user.userId} 사용자 정보가 수정되었습니다.`)
      } else {
        await userService.createUser({ userId, password, department, role, groups: selectedGroups })
        toast('success', `${userId} 사용자가 추가되었습니다.`)
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
    <Modal open onClose={onClose} title={isEdit ? '사용자 수정' : '사용자 추가'}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          label="아이디"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          disabled={isEdit}
          required
        />
        {!isEdit && (
          <Input
            label="초기 비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        )}
        <Input
          label="부서"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        />
        <Select
          label="역할"
          value={role}
          onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
          options={[
            { value: 'user', label: '일반 사용자' },
            { value: 'admin', label: '관리자' },
          ]}
        />

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">소속 그룹</label>
          <div className="space-y-1 max-h-32 overflow-y-auto border border-border-secondary rounded-md p-2">
            {groups.map((g) => (
              <label key={g.id} className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedGroups.includes(g.id)}
                  onChange={() => toggleGroup(g.id)}
                  className="rounded"
                />
                {g.name}
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
