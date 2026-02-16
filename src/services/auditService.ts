import { apiClient } from './api'
import type { AuditLog, AuditLogFilter, PaginatedResponse } from '../types/audit'

export const auditService = {
  getLogs(filter: AuditLogFilter) {
    const query: Record<string, string> = {
      page: String(filter.page),
      pageSize: String(filter.pageSize),
    }
    if (filter.startDate) query.startDate = filter.startDate
    if (filter.endDate) query.endDate = filter.endDate
    if (filter.userId) query.userId = String(filter.userId)
    if (filter.menu) query.menu = filter.menu
    if (filter.action) query.action = filter.action

    return apiClient<PaginatedResponse<AuditLog>>('GET', '/audit-logs', { query })
  },
}
