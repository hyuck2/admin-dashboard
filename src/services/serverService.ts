import { apiClient } from './api'
import type {
  ServerGroup,
  Server,
  CreateServerRequest,
  UpdateServerRequest,
  SshTestResult,
  GroupExecuteResult,
} from '../types/server'

export const serverService = {
  // Groups
  getGroups() {
    return apiClient<ServerGroup[]>('GET', '/servers/groups')
  },
  createGroup(data: { name: string; description?: string }) {
    return apiClient<ServerGroup>('POST', '/servers/groups', { body: data })
  },
  updateGroup(id: number, data: { name?: string; description?: string }) {
    return apiClient<ServerGroup>('PUT', `/servers/groups/${id}`, { body: data })
  },
  deleteGroup(id: number) {
    return apiClient<{ message: string }>('DELETE', `/servers/groups/${id}`)
  },

  // Servers
  getServers(params?: { groupId?: number; status?: string; search?: string }) {
    const query: Record<string, string> = {}
    if (params?.groupId) query.groupId = String(params.groupId)
    if (params?.status) query.status = params.status
    if (params?.search) query.search = params.search
    return apiClient<Server[]>('GET', '/servers/', { query })
  },
  createServer(data: CreateServerRequest) {
    return apiClient<Server>('POST', '/servers/', { body: data })
  },
  bulkCreateServers(servers: CreateServerRequest[]) {
    return apiClient<Server[]>('POST', '/servers/bulk', { body: { servers } })
  },
  updateServer(id: number, data: UpdateServerRequest) {
    return apiClient<Server>('PUT', `/servers/${id}`, { body: data })
  },
  deleteServer(id: number) {
    return apiClient<{ message: string }>('DELETE', `/servers/${id}`)
  },

  // SSH Test
  testSsh(serverId: number) {
    return apiClient<SshTestResult>('POST', `/servers/${serverId}/test-ssh`)
  },
  testSshBulk(serverIds: number[]) {
    return apiClient<SshTestResult[]>('POST', '/servers/test-ssh-bulk', { body: { serverIds } })
  },

  // Group Execute
  groupExecute(groupId: number, command: string) {
    return apiClient<GroupExecuteResult[]>('POST', `/servers/groups/${groupId}/execute`, {
      body: { command },
    })
  },
}
