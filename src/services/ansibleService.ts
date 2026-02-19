import { apiClient } from './api'
import type { Playbook, Inventory, AnsibleExecution } from '../types/server'

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const ansibleService = {
  // Playbooks
  getPlaybooks() {
    return apiClient<Playbook[]>('GET', '/ansible/playbooks')
  },
  getPlaybook(id: number) {
    return apiClient<Playbook>('GET', `/ansible/playbooks/${id}`)
  },
  createPlaybook(data: { name: string; description?: string; content: string }) {
    return apiClient<Playbook>('POST', '/ansible/playbooks', { body: data })
  },
  updatePlaybook(id: number, data: { name?: string; description?: string; content?: string }) {
    return apiClient<Playbook>('PUT', `/ansible/playbooks/${id}`, { body: data })
  },
  deletePlaybook(id: number) {
    return apiClient<{ message: string }>('DELETE', `/ansible/playbooks/${id}`)
  },

  // Inventories
  getInventories() {
    return apiClient<Inventory[]>('GET', '/ansible/inventories')
  },
  getInventory(id: number) {
    return apiClient<Inventory>('GET', `/ansible/inventories/${id}`)
  },
  createInventory(data: { name: string; groupId?: number | null; content: string }) {
    return apiClient<Inventory>('POST', '/ansible/inventories', { body: data })
  },
  updateInventory(id: number, data: { name?: string; groupId?: number | null; content?: string }) {
    return apiClient<Inventory>('PUT', `/ansible/inventories/${id}`, { body: data })
  },
  deleteInventory(id: number) {
    return apiClient<{ message: string }>('DELETE', `/ansible/inventories/${id}`)
  },
  generateInventory(groupId: number) {
    return apiClient<{ content: string }>('POST', `/ansible/inventories/generate/${groupId}`)
  },

  // Execution
  executePlaybook(playbookId: number, inventoryId: number, extraVars?: string) {
    return apiClient<AnsibleExecution>('POST', `/ansible/playbooks/${playbookId}/execute`, {
      body: { inventoryId, extraVars },
    })
  },
  getExecutions(page = 1, pageSize = 20) {
    return apiClient<PaginatedResponse<AnsibleExecution>>('GET', '/ansible/executions', {
      query: { page: String(page), pageSize: String(pageSize) },
    })
  },
  getExecution(id: number) {
    return apiClient<AnsibleExecution>('GET', `/ansible/executions/${id}`)
  },
}
