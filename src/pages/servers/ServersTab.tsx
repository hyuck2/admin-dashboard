import { useEffect, useState, useCallback } from 'react'
import { Plus, Upload, Wifi, RefreshCw, MoreHorizontal, Terminal, Pencil, Trash2 } from 'lucide-react'
import { serverService } from '../../services/serverService'
import type { Server, ServerGroup, CreateServerRequest } from '../../types/server'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import ServerModal from './ServerModal'
import BulkServerModal from './BulkServerModal'
import SshTerminalModal from './SshTerminalModal'

export default function ServersTab() {
  const [servers, setServers] = useState<Server[]>([])
  const [groups, setGroups] = useState<ServerGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterGroup, setFilterGroup] = useState<number | undefined>()
  const [filterStatus, setFilterStatus] = useState<string | undefined>()
  const [modalOpen, setModalOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [editServer, setEditServer] = useState<Server | null>(null)
  const [sshServer, setSshServer] = useState<Server | null>(null)
  const [actionMenu, setActionMenu] = useState<number | null>(null)
  const [testingIds, setTestingIds] = useState<Set<number>>(new Set())

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [s, g] = await Promise.all([
        serverService.getServers({ groupId: filterGroup, status: filterStatus, search: search || undefined }),
        serverService.getGroups(),
      ])
      setServers(s)
      setGroups(g)
    } finally {
      setLoading(false)
    }
  }, [filterGroup, filterStatus, search])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreate = async (data: CreateServerRequest) => {
    await serverService.createServer(data)
    setModalOpen(false)
    fetchData()
  }

  const handleUpdate = async (data: CreateServerRequest) => {
    if (!editServer) return
    await serverService.updateServer(editServer.id, {
      ...data,
      sshPassword: data.sshPassword || undefined,
    })
    setEditServer(null)
    fetchData()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('서버를 삭제하시겠습니까?')) return
    await serverService.deleteServer(id)
    fetchData()
  }

  const handleBulk = async (servers: CreateServerRequest[]) => {
    await serverService.bulkCreateServers(servers)
    setBulkOpen(false)
    fetchData()
  }

  const handleTestSsh = async (id: number) => {
    setTestingIds((prev) => new Set(prev).add(id))
    try {
      await serverService.testSsh(id)
      fetchData()
    } finally {
      setTestingIds((prev) => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  const handleTestAll = async () => {
    const ids = servers.map((s) => s.id)
    setTestingIds(new Set(ids))
    try {
      await serverService.testSshBulk(ids)
      fetchData()
    } finally {
      setTestingIds(new Set())
    }
  }

  const statusBadge = (status: string) => {
    if (status === 'online') return <Badge variant="success">Online</Badge>
    if (status === 'offline') return <Badge variant="danger">Offline</Badge>
    return <Badge variant="default">Unknown</Badge>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <input
            className="text-xs bg-bg-primary text-text-primary border border-border-secondary rounded px-2 py-1 w-48 focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="검색 (hostname, IP)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="text-xs bg-bg-primary text-text-primary border border-border-secondary rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent"
            value={filterGroup ?? ''}
            onChange={(e) => setFilterGroup(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">모든 그룹</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select
            className="text-xs bg-bg-primary text-text-primary border border-border-secondary rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent"
            value={filterStatus ?? ''}
            onChange={(e) => setFilterStatus(e.target.value || undefined)}
          >
            <option value="">모든 상태</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="unknown">Unknown</option>
          </select>
          {loading && <Spinner className="h-4 w-4" />}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleTestAll} disabled={servers.length === 0}>
            <Wifi size={14} className="mr-1" />SSH 전체 테스트
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setBulkOpen(true)}>
            <Upload size={14} className="mr-1" />대량 등록
          </Button>
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus size={14} className="mr-1" />서버 등록
          </Button>
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      <div className="border border-border-primary rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-bg-tertiary">
            <tr>
              <th className="px-3 py-2 text-left text-text-secondary font-medium">Hostname</th>
              <th className="px-3 py-2 text-left text-text-secondary font-medium">IP</th>
              <th className="px-3 py-2 text-left text-text-secondary font-medium">포트</th>
              <th className="px-3 py-2 text-left text-text-secondary font-medium">그룹</th>
              <th className="px-3 py-2 text-left text-text-secondary font-medium">상태</th>
              <th className="px-3 py-2 text-left text-text-secondary font-medium">OS</th>
              <th className="px-3 py-2 text-right text-text-secondary font-medium">액션</th>
            </tr>
          </thead>
          <tbody>
            {servers.map((s) => (
              <tr key={s.id} className="border-t border-border-primary hover:bg-bg-hover">
                <td className="px-3 py-2 text-text-primary font-medium">{s.hostname}</td>
                <td className="px-3 py-2 text-text-secondary font-mono">{s.ipAddress}</td>
                <td className="px-3 py-2 text-text-secondary">{s.sshPort}</td>
                <td className="px-3 py-2 text-text-secondary">{s.groupName || '-'}</td>
                <td className="px-3 py-2">
                  {testingIds.has(s.id) ? <Spinner className="h-3 w-3" /> : statusBadge(s.status)}
                </td>
                <td className="px-3 py-2 text-text-secondary">{s.osInfo || '-'}</td>
                <td className="px-3 py-2 text-right relative">
                  <button
                    onClick={() => setActionMenu(actionMenu === s.id ? null : s.id)}
                    className="p-1 rounded hover:bg-bg-active text-text-tertiary"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {actionMenu === s.id && (
                    <div className="absolute right-0 top-8 z-20 bg-bg-secondary border border-border-primary rounded-md shadow-lg py-1 w-36">
                      <button onClick={() => { setSshServer(s); setActionMenu(null) }} className="w-full px-3 py-1.5 text-left text-xs hover:bg-bg-hover flex items-center gap-2 text-text-primary">
                        <Terminal size={12} />SSH 접속
                      </button>
                      <button onClick={() => { handleTestSsh(s.id); setActionMenu(null) }} className="w-full px-3 py-1.5 text-left text-xs hover:bg-bg-hover flex items-center gap-2 text-text-primary">
                        <Wifi size={12} />SSH 테스트
                      </button>
                      <button onClick={() => { setEditServer(s); setActionMenu(null) }} className="w-full px-3 py-1.5 text-left text-xs hover:bg-bg-hover flex items-center gap-2 text-text-primary">
                        <Pencil size={12} />편집
                      </button>
                      <button onClick={() => { handleDelete(s.id); setActionMenu(null) }} className="w-full px-3 py-1.5 text-left text-xs hover:bg-bg-hover flex items-center gap-2 text-danger">
                        <Trash2 size={12} />삭제
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {servers.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-text-tertiary">등록된 서버가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ServerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        groups={groups}
      />
      <ServerModal
        open={!!editServer}
        onClose={() => setEditServer(null)}
        onSubmit={handleUpdate}
        server={editServer}
        groups={groups}
      />
      <BulkServerModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onSubmit={handleBulk}
        groups={groups}
      />
      {sshServer && (
        <SshTerminalModal
          server={sshServer}
          onClose={() => setSshServer(null)}
        />
      )}
    </div>
  )
}
