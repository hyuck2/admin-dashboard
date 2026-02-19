import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Play, RefreshCw, FileText, FolderOpen } from 'lucide-react'
import { ansibleService } from '../../services/ansibleService'
import { serverService } from '../../services/serverService'
import type { Playbook, Inventory, AnsibleExecution, ServerGroup } from '../../types/server'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import Tabs from '../../components/ui/Tabs'
import PlaybookModal from './PlaybookModal'
import InventoryModal from './InventoryModal'
import ExecutePlaybookModal from './ExecutePlaybookModal'

const subTabs = [
  { id: 'playbooks', label: 'Playbook' },
  { id: 'inventories', label: 'Inventory' },
  { id: 'executions', label: '실행 이력' },
]

export default function AnsibleTab() {
  const navigate = useNavigate()
  const [subTab, setSubTab] = useState('playbooks')
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [inventories, setInventories] = useState<Inventory[]>([])
  const [executions, setExecutions] = useState<AnsibleExecution[]>([])
  const [groups, setGroups] = useState<ServerGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [playbookModal, setPlaybookModal] = useState(false)
  const [editPlaybook, setEditPlaybook] = useState<Playbook | null>(null)
  const [inventoryModal, setInventoryModal] = useState(false)
  const [editInventory, setEditInventory] = useState<Inventory | null>(null)
  const [executeModal, setExecuteModal] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [pbs, invs, execs, grps] = await Promise.all([
        ansibleService.getPlaybooks(),
        ansibleService.getInventories(),
        ansibleService.getExecutions(),
        serverService.getGroups(),
      ])
      setPlaybooks(pbs)
      setInventories(invs)
      setExecutions(execs.items)
      setGroups(grps)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const handleDeletePlaybook = async (id: number) => {
    if (!confirm('Playbook을 삭제하시겠습니까?')) return
    await ansibleService.deletePlaybook(id)
    fetchAll()
  }

  const handleDeleteInventory = async (id: number) => {
    if (!confirm('Inventory를 삭제하시겠습니까?')) return
    await ansibleService.deleteInventory(id)
    fetchAll()
  }

  const statusBadge = (status: string) => {
    if (status === 'success') return <Badge variant="success">Success</Badge>
    if (status === 'failed') return <Badge variant="danger">Failed</Badge>
    if (status === 'running') return <Badge variant="warning">Running</Badge>
    return <Badge variant="default">{status}</Badge>
  }

  return (
    <div>
      <Tabs tabs={subTabs} activeTab={subTab} onChange={setSubTab} />
      <div className="mt-4">
        {/* Playbooks */}
        {subTab === 'playbooks' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-text-secondary">{playbooks.length}개 Playbook</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => setExecuteModal(true)} disabled={playbooks.length === 0 || inventories.length === 0}>
                  <Play size={14} className="mr-1" />실행
                </Button>
                <Button size="sm" onClick={() => setPlaybookModal(true)}>
                  <Plus size={14} className="mr-1" />Playbook 생성
                </Button>
                <Button variant="ghost" size="sm" onClick={fetchAll}><RefreshCw size={14} /></Button>
              </div>
            </div>
            <div className="border border-border-primary rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-bg-tertiary">
                  <tr>
                    <th className="px-3 py-2 text-left text-text-secondary font-medium">이름</th>
                    <th className="px-3 py-2 text-left text-text-secondary font-medium">설명</th>
                    <th className="px-3 py-2 text-left text-text-secondary font-medium">수정일</th>
                    <th className="px-3 py-2 text-right text-text-secondary font-medium">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {playbooks.map((p) => (
                    <tr key={p.id} className="border-t border-border-primary hover:bg-bg-hover">
                      <td className="px-3 py-2 text-text-primary font-medium flex items-center gap-1">
                        <FileText size={12} className="text-text-tertiary" />{p.name}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">{p.description || '-'}</td>
                      <td className="px-3 py-2 text-text-secondary">{p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '-'}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditPlaybook(p)} className="p-1 rounded hover:bg-bg-active text-text-tertiary"><Pencil size={13} /></button>
                          <button onClick={() => handleDeletePlaybook(p.id)} className="p-1 rounded hover:bg-bg-active text-danger"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {playbooks.length === 0 && !loading && (
                    <tr><td colSpan={4} className="px-3 py-8 text-center text-text-tertiary">Playbook이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Inventories */}
        {subTab === 'inventories' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-text-secondary">{inventories.length}개 Inventory</span>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => setInventoryModal(true)}>
                  <Plus size={14} className="mr-1" />Inventory 생성
                </Button>
                <Button variant="ghost" size="sm" onClick={fetchAll}><RefreshCw size={14} /></Button>
              </div>
            </div>
            <div className="border border-border-primary rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-bg-tertiary">
                  <tr>
                    <th className="px-3 py-2 text-left text-text-secondary font-medium">이름</th>
                    <th className="px-3 py-2 text-left text-text-secondary font-medium">그룹</th>
                    <th className="px-3 py-2 text-left text-text-secondary font-medium">수정일</th>
                    <th className="px-3 py-2 text-right text-text-secondary font-medium">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {inventories.map((inv) => (
                    <tr key={inv.id} className="border-t border-border-primary hover:bg-bg-hover">
                      <td className="px-3 py-2 text-text-primary font-medium flex items-center gap-1">
                        <FolderOpen size={12} className="text-text-tertiary" />{inv.name}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">{inv.groupName || '-'}</td>
                      <td className="px-3 py-2 text-text-secondary">{inv.updatedAt ? new Date(inv.updatedAt).toLocaleDateString() : '-'}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditInventory(inv)} className="p-1 rounded hover:bg-bg-active text-text-tertiary"><Pencil size={13} /></button>
                          <button onClick={() => handleDeleteInventory(inv.id)} className="p-1 rounded hover:bg-bg-active text-danger"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {inventories.length === 0 && !loading && (
                    <tr><td colSpan={4} className="px-3 py-8 text-center text-text-tertiary">Inventory가 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Executions */}
        {subTab === 'executions' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-text-secondary">실행 이력</span>
              <Button variant="ghost" size="sm" onClick={fetchAll}><RefreshCw size={14} /></Button>
            </div>
            <div className="border border-border-primary rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-bg-tertiary">
                  <tr>
                    <th className="px-3 py-2 text-left text-text-secondary font-medium">#</th>
                    <th className="px-3 py-2 text-left text-text-secondary font-medium">Playbook</th>
                    <th className="px-3 py-2 text-left text-text-secondary font-medium">상태</th>
                    <th className="px-3 py-2 text-left text-text-secondary font-medium">실행자</th>
                    <th className="px-3 py-2 text-left text-text-secondary font-medium">시작</th>
                    <th className="px-3 py-2 text-left text-text-secondary font-medium">완료</th>
                  </tr>
                </thead>
                <tbody>
                  {executions.map((ex) => (
                    <tr key={ex.id} className="border-t border-border-primary hover:bg-bg-hover cursor-pointer" onClick={() => navigate(`/servers/ansible/executions/${ex.id}`)}>
                      <td className="px-3 py-2 text-text-tertiary">{ex.id}</td>
                      <td className="px-3 py-2 text-text-primary">{ex.playbookName}</td>
                      <td className="px-3 py-2">{statusBadge(ex.status)}</td>
                      <td className="px-3 py-2 text-text-secondary">{ex.startedByName}</td>
                      <td className="px-3 py-2 text-text-secondary">{ex.startedAt ? new Date(ex.startedAt).toLocaleString() : '-'}</td>
                      <td className="px-3 py-2 text-text-secondary">{ex.finishedAt ? new Date(ex.finishedAt).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                  {executions.length === 0 && !loading && (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-text-tertiary">실행 이력이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {loading && <div className="flex justify-center py-4"><Spinner className="h-4 w-4" /></div>}

      <PlaybookModal open={playbookModal} onClose={() => setPlaybookModal(false)} onSubmit={async (d) => { await ansibleService.createPlaybook(d); setPlaybookModal(false); fetchAll() }} />
      <PlaybookModal open={!!editPlaybook} onClose={() => setEditPlaybook(null)} playbook={editPlaybook} onSubmit={async (d) => { if (editPlaybook) await ansibleService.updatePlaybook(editPlaybook.id, d); setEditPlaybook(null); fetchAll() }} />
      <InventoryModal open={inventoryModal} onClose={() => setInventoryModal(false)} groups={groups} onSubmit={async (d) => { await ansibleService.createInventory(d); setInventoryModal(false); fetchAll() }} />
      <InventoryModal open={!!editInventory} onClose={() => setEditInventory(null)} inventory={editInventory} groups={groups} onSubmit={async (d) => { if (editInventory) await ansibleService.updateInventory(editInventory.id, d); setEditInventory(null); fetchAll() }} />
      <ExecutePlaybookModal open={executeModal} onClose={() => setExecuteModal(false)} playbooks={playbooks} inventories={inventories} onExecute={async (pbId, invId) => { await ansibleService.executePlaybook(pbId, invId); setExecuteModal(false); setSubTab('executions'); fetchAll() }} />
    </div>
  )
}
