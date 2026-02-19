import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Play, RefreshCw } from 'lucide-react'
import { serverService } from '../../services/serverService'
import type { ServerGroup } from '../../types/server'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import ServerGroupModal from './ServerGroupModal'
import GroupExecuteModal from './GroupExecuteModal'

export default function ServerGroupsTab() {
  const [groups, setGroups] = useState<ServerGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editGroup, setEditGroup] = useState<ServerGroup | null>(null)
  const [executeGroup, setExecuteGroup] = useState<ServerGroup | null>(null)

  const fetchGroups = async () => {
    setLoading(true)
    try {
      const data = await serverService.getGroups()
      setGroups(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchGroups() }, [])

  const handleCreate = async (data: { name: string; description: string }) => {
    await serverService.createGroup(data)
    setModalOpen(false)
    fetchGroups()
  }

  const handleUpdate = async (data: { name: string; description: string }) => {
    if (!editGroup) return
    await serverService.updateGroup(editGroup.id, data)
    setEditGroup(null)
    fetchGroups()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('그룹을 삭제하시겠습니까?')) return
    await serverService.deleteGroup(id)
    fetchGroups()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">총 {groups.length}개 그룹</span>
          {loading && <Spinner className="h-4 w-4" />}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus size={14} className="mr-1" />그룹 생성
          </Button>
          <Button variant="ghost" size="sm" onClick={fetchGroups}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      <div className="border border-border-primary rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-bg-tertiary">
            <tr>
              <th className="px-3 py-2 text-left text-text-secondary font-medium">이름</th>
              <th className="px-3 py-2 text-left text-text-secondary font-medium">설명</th>
              <th className="px-3 py-2 text-left text-text-secondary font-medium">서버 수</th>
              <th className="px-3 py-2 text-left text-text-secondary font-medium">생성일</th>
              <th className="px-3 py-2 text-right text-text-secondary font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id} className="border-t border-border-primary hover:bg-bg-hover">
                <td className="px-3 py-2 text-text-primary font-medium">{g.name}</td>
                <td className="px-3 py-2 text-text-secondary">{g.description || '-'}</td>
                <td className="px-3 py-2 text-text-secondary">{g.serverCount}</td>
                <td className="px-3 py-2 text-text-secondary">{g.createdAt ? new Date(g.createdAt).toLocaleDateString() : '-'}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setExecuteGroup(g)} className="p-1 rounded hover:bg-bg-active text-text-tertiary" title="명령 실행">
                      <Play size={13} />
                    </button>
                    <button onClick={() => setEditGroup(g)} className="p-1 rounded hover:bg-bg-active text-text-tertiary" title="편집">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(g.id)} className="p-1 rounded hover:bg-bg-active text-danger" title="삭제">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {groups.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-text-tertiary">등록된 그룹이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ServerGroupModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
      />
      <ServerGroupModal
        open={!!editGroup}
        onClose={() => setEditGroup(null)}
        onSubmit={handleUpdate}
        group={editGroup}
      />
      {executeGroup && (
        <GroupExecuteModal
          group={executeGroup}
          onClose={() => setExecuteGroup(null)}
        />
      )}
    </div>
  )
}
