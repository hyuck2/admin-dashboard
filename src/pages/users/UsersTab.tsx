import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { userService } from '../../services/userService'
import type { User } from '../../types/auth'
import type { Group } from '../../types/user'
import Table from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import UserModal from './UserModal'
import { toast } from '../../components/ui/Toast'
import ConfirmModal from '../../components/ui/ConfirmModal'

export default function UsersTab() {
  const [users, setUsers] = useState<User[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [modalUser, setModalUser] = useState<User | null | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [u, g] = await Promise.all([userService.getUsers(), userService.getGroups()])
      setUsers(u)
      setGroups(g)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await userService.deleteUser(deleteTarget.id)
      toast('success', `${deleteTarget.userId} 사용자가 삭제되었습니다.`)
      setDeleteTarget(null)
      fetchData()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : '삭제에 실패했습니다.')
    }
  }

  const getGroupNames = (groupIds: number[]) =>
    groupIds.map((id) => groups.find((g) => g.id === id)?.name).filter(Boolean).join(', ') || '-'

  const columns = [
    { key: 'userId', header: 'ID', render: (u: User) => <span className="font-medium">{u.userId}</span> },
    { key: 'department', header: '부서', render: (u: User) => u.department || '-' },
    { key: 'role', header: '역할', render: (u: User) => (
      <Badge variant={u.role === 'admin' ? 'warning' : 'default'}>{u.role}</Badge>
    )},
    { key: 'groups', header: '소속 그룹', render: (u: User) => getGroupNames(u.groups) },
    { key: 'isActive', header: '상태', render: (u: User) => (
      <Badge variant={u.isActive ? 'success' : 'danger'}>{u.isActive ? '활성' : '비활성'}</Badge>
    )},
    { key: 'actions', header: '', className: 'w-32', render: (u: User) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={() => setModalUser(u)}>수정</Button>
        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(u)}>삭제</Button>
      </div>
    )},
  ]

  if (loading) return <div className="flex justify-center py-10"><Spinner className="h-6 w-6" /></div>

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setModalUser(null)}>
          <Plus size={14} className="mr-1" /> 사용자 추가
        </Button>
      </div>

      <Table columns={columns} data={users} keyExtractor={(u) => u.id} />

      {modalUser !== undefined && (
        <UserModal
          user={modalUser}
          groups={groups}
          onClose={() => setModalUser(undefined)}
          onComplete={fetchData}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="사용자 삭제"
        message={`${deleteTarget?.userId} 사용자를 삭제하시겠습니까?`}
        confirmText="삭제"
        danger
      />
    </>
  )
}
