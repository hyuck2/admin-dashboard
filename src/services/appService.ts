import { apiClient } from './api'
import type { AppStatus, AppTag, RollbackRequest, ReplicaChangeRequest } from '../types/app'

export const appService = {
  getApps() {
    return apiClient<AppStatus[]>('GET', '/apps')
  },

  getTags(appName: string) {
    return apiClient<AppTag[]>('GET', '/apps/tags', { query: { appName } })
  },

  rollback(data: RollbackRequest) {
    return apiClient<{ message: string }>('POST', '/apps/rollback', { body: data })
  },

  changeReplica(data: ReplicaChangeRequest) {
    return apiClient<{ message: string }>('POST', '/apps/replica', { body: data })
  },
}
