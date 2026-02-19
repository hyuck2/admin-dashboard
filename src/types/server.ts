export interface ServerGroup {
  id: number
  name: string
  description: string
  serverCount: number
  createdAt: string
  updatedAt: string
}

export interface Server {
  id: number
  hostname: string
  ipAddress: string
  sshPort: number
  sshUsername: string
  osInfo: string
  description: string
  groupId: number | null
  groupName: string | null
  status: 'unknown' | 'online' | 'offline'
  lastCheckedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateServerRequest {
  hostname: string
  ipAddress: string
  sshPort: number
  sshUsername: string
  sshPassword: string
  osInfo?: string
  description?: string
  groupId?: number | null
}

export interface UpdateServerRequest {
  hostname?: string
  ipAddress?: string
  sshPort?: number
  sshUsername?: string
  sshPassword?: string
  osInfo?: string
  description?: string
  groupId?: number | null
}

export interface SshTestResult {
  serverId: number
  hostname: string
  ipAddress: string
  success: boolean
  message: string
}

export interface GroupExecuteResult {
  serverId: number
  hostname: string
  ipAddress: string
  exitCode: number
  stdout: string
  stderr: string
}

export interface MetricSource {
  id: number
  name: string
  url: string
  description: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface MetricTarget {
  instance: string
  job: string
  health: string
  matchedServerId: number | null
  matchedHostname: string | null
}

export interface ServerMetrics {
  cpu: [number, string][]
  memory: [number, string][]
  disk: [number, string][]
}

export interface Playbook {
  id: number
  name: string
  description: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface Inventory {
  id: number
  name: string
  groupId: number | null
  groupName: string | null
  content: string
  createdAt: string
  updatedAt: string
}

export interface AnsibleExecution {
  id: number
  playbookId: number
  playbookName: string
  inventoryId: number | null
  targetType: string
  targetIds: number[]
  status: 'running' | 'success' | 'failed' | 'cancelled'
  startedBy: number
  startedByName: string
  log: string | null
  startedAt: string
  finishedAt: string | null
}
