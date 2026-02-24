import { apiClient } from './api'
import type { AppStatus, AppTag, RollbackRequest, ReplicaChangeRequest } from '../types/app'

export const appService = {
  getApps(forceRefresh = false) {
    const params = forceRefresh ? '?force_refresh=true' : ''
    return apiClient<AppStatus[]>('GET', `/apps${params}`)
  },

  getTags(appName: string, env: string) {
    return apiClient<AppTag[]>('GET', '/apps/tags', { query: { appName, env } })
  },

  rollback(data: RollbackRequest) {
    return apiClient<{ message: string }>('POST', '/apps/rollback', { body: data })
  },

  changeReplica(data: ReplicaChangeRequest) {
    return apiClient<{ message: string }>('POST', '/apps/replica', { body: data })
  },
}
