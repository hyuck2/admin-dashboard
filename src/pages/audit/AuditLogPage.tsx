import { useEffect, useState, useCallback } from 'react'
import { Search } from 'lucide-react'
import { auditService } from '../../services/auditService'
import type { AuditLog, AuditLogFilter } from '../../types/audit'
import Table from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Pagination from '../../components/ui/Pagination'
import Select from '../../components/ui/Select'
import Spinner from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { formatDate } from '../../utils/formatDate'

const menuOptions = [
  { value: '', label: '전체 메뉴' },
  { value: 'apps', label: 'UI Application 관리' },
  { value: 'users', label: '사용자 & 권한 관리' },
]

const actionOptions = [
  { value: '', label: '전체 액션' },
  { value: 'rollback', label: 'Rollback' },
  { value: 'scale', label: 'Scale' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
]

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null)

  const [filter, setFilter] = useState<AuditLogFilter>({
    page: 1,
    pageSize: 10,
    menu: '',
    action: '',
  })

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const cleanFilter: AuditLogFilter = {
        page: filter.page,
        pageSize: filter.pageSize,
      }
      if (filter.menu) cleanFilter.menu = filter.menu
      if (filter.action) cleanFilter.action = filter.action
      if (filter.startDate) cleanFilter.startDate = filter.startDate
      if (filter.endDate) cleanFilter.endDate = filter.endDate

      const result = await auditService.getLogs(cleanFilter)
      setLogs(result.items)
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const columns = [
    { key: 'createdAt', header: '시간', render: (l: AuditLog) => (
      <span className="text-xs text-text-secondary">{formatDate(l.createdAt)}</span>
    )},
    { key: 'userName', header: '사용자', render: (l: AuditLog) => l.userName },
    { key: 'menu', header: '메뉴', render: (l: AuditLog) => l.menu },
    { key: 'action', header: '액션', render: (l: AuditLog) => l.action },
    { key: 'target', header: '대상', render: (l: AuditLog) => `${l.targetType}/${l.targetName}` },
    { key: 'result', header: '결과', render: (l: AuditLog) => (
      <Badge variant={l.result === 'success' ? 'success' : 'danger'}>{l.result}</Badge>
    )},
    { key: 'detail', header: '', className: 'w-16', render: (l: AuditLog) => (
      <Button variant="ghost" size="sm" onClick={() => setDetailLog(l)}>상세</Button>
    )},
  ]

  return (
    <div>
      <h1 className="text-lg font-semibold text-text-primary mb-4">감사 로그</h1>

      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">시작일</label>
          <input
            type="date"
            value={filter.startDate ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, startDate: e.target.value || undefined, page: 1 }))}
            className="px-3 py-1.5 text-sm bg-bg-primary text-text-primary border border-border-secondary rounded-md"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">종료일</label>
          <input
            type="date"
            value={filter.endDate ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, endDate: e.target.value || undefined, page: 1 }))}
            className="px-3 py-1.5 text-sm bg-bg-primary text-text-primary border border-border-secondary rounded-md"
          />
        </div>
        <Select
          label="메뉴"
          value={filter.menu ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, menu: e.target.value || undefined, page: 1 }))}
          options={menuOptions}
        />
        <Select
          label="액션"
          value={filter.action ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, action: e.target.value || undefined, page: 1 }))}
          options={actionOptions}
        />
        <Button variant="secondary" size="sm" onClick={() => setFilter({ page: 1, pageSize: 10 })}>
          <Search size={14} className="mr-1" /> 초기화
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner className="h-6 w-6" /></div>
      ) : (
        <>
          <p className="text-xs text-text-tertiary mb-2">총 {total}건</p>
          <Table columns={columns} data={logs} keyExtractor={(l) => l.id} />
          <Pagination
            page={filter.page}
            totalPages={totalPages}
            onPageChange={(p) => setFilter((f) => ({ ...f, page: p }))}
          />
        </>
      )}

      {detailLog && (
        <Modal open onClose={() => setDetailLog(null)} title="감사 로그 상세" maxWidth="max-w-lg">
          <div className="space-y-2 text-sm">
            <div><span className="text-text-secondary">시간:</span> {formatDate(detailLog.createdAt)}</div>
            <div><span className="text-text-secondary">사용자:</span> {detailLog.userName}</div>
            <div><span className="text-text-secondary">메뉴:</span> {detailLog.menu}</div>
            <div><span className="text-text-secondary">액션:</span> {detailLog.action}</div>
            <div><span className="text-text-secondary">대상:</span> {detailLog.targetType}/{detailLog.targetName}</div>
            <div><span className="text-text-secondary">결과:</span> {detailLog.result}</div>
            <div><span className="text-text-secondary">IP:</span> {detailLog.ipAddress}</div>
            <div>
              <span className="text-text-secondary">상세 정보:</span>
              <pre className="mt-1 p-2 bg-bg-tertiary rounded-md text-xs overflow-x-auto">
                {JSON.stringify(detailLog.detail, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
