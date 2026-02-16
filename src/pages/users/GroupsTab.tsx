import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { userService } from '../../services/userService'
import type { Group, Permission } from '../../types/user'
import Table from '../../components/ui/Table'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import GroupModal from './GroupModal'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { toast } from '../../components/ui/Toast'

export default function GroupsTab() {
  const [groups, setGroups] = useState<Group[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [modalGroup, setModalGroup] = useState<Group | null | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [g, p] = await Promise.all([userService.getGroups(), userService.getPermissions()])
      setGroups(g)
      setPermissions(p)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await userService.deleteGroup(deleteTarget.id)
      toast('success', `${deleteTarget.name} 그룹이 삭제되었습니다.`)
      setDeleteTarget(null)
      fetchData()
    } catch (err) {
      toast('error', err instanceof Error ? err.message : '삭제에 실패했습니다.')
    }
  }

  const getPermissionSummary = (permIds: number[]) => {
    const perms = permIds.map((id) => permissions.find((p) => p.id === id)).filter(Boolean)
    return perms.length > 0 ? `${perms.length}개 권한` : '-'
  }

  const columns = [
    { key: 'name', header: '그룹명', render: (g: Group) => <span className="font-medium">{g.name}</span> },
    { key: 'description', header: '설명', render: (g: Group) => g.description || '-' },
    { key: 'permissions', header: '권한', render: (g: Group) => getPermissionSummary(g.permissions) },
    { key: 'members', header: '멤버 수', render: (g: Group) => `${g.members.length}명` },
    { key: 'actions', header: '', className: 'w-32', render: (g: Group) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={() => setModalGroup(g)}>수정</Button>
        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(g)}>삭제</Button>
      </div>
    )},
  ]

  if (loading) return <div className="flex justify-center py-10"><Spinner className="h-6 w-6" /></div>

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setModalGroup(null)}>
          <Plus size={14} className="mr-1" /> 그룹 추가
        </Button>
      </div>

      <Table columns={columns} data={groups} keyExtractor={(g) => g.id} />

      {modalGroup !== undefined && (
        <GroupModal
          group={modalGroup}
          permissions={permissions}
          onClose={() => setModalGroup(undefined)}
          onComplete={fetchData}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="그룹 삭제"
        message={`${deleteTarget?.name} 그룹을 삭제하시겠습니까?`}
        confirmText="삭제"
        danger
      />
    </>
  )
}
