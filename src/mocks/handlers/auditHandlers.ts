import { mockAuditLogs } from '../data/auditLogs'
import type { AuditLogFilter, PaginatedResponse, AuditLog } from '../../types/audit'

export function handleGetAuditLogs(filter: AuditLogFilter): { status: number; data: PaginatedResponse<AuditLog> } {
  let filtered = [...mockAuditLogs]

  if (filter.startDate) {
    filtered = filtered.filter((log) => log.createdAt >= filter.startDate!)
  }
  if (filter.endDate) {
    filtered = filtered.filter((log) => log.createdAt <= filter.endDate!)
  }
  if (filter.userId) {
    filtered = filtered.filter((log) => log.userId === filter.userId)
  }
  if (filter.menu) {
    filtered = filtered.filter((log) => log.menu === filter.menu)
  }
  if (filter.action) {
    filtered = filtered.filter((log) => log.action === filter.action)
  }

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const total = filtered.length
  const totalPages = Math.ceil(total / filter.pageSize)
  const start = (filter.page - 1) * filter.pageSize
  const items = filtered.slice(start, start + filter.pageSize)

  return {
    status: 200,
    data: { items, total, page: filter.page, pageSize: filter.pageSize, totalPages },
  }
}
