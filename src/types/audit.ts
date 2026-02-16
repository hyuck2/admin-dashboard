export interface AuditLog {
  id: number
  userId: number
  userName: string
  action: string
  menu: string
  targetType: string
  targetName: string
  detail: Record<string, unknown>
  result: 'success' | 'failed'
  ipAddress: string
  createdAt: string
}

export interface AuditLogFilter {
  startDate?: string
  endDate?: string
  userId?: number
  menu?: string
  action?: string
  page: number
  pageSize: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
