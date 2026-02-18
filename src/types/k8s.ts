export interface ResourceUsage {
  total: number
  used: number
  percentage: number
}

export interface NodeStatus {
  total: number
  ready: number
}

export interface ClusterInfo {
  name: string
  context: string
  apiServer: string
  status: 'healthy' | 'unhealthy' | 'unknown'
  nodes: NodeStatus | null
  cpu: ResourceUsage | null
  memory: ResourceUsage | null
}

export interface ClusterListResponse {
  clusters: ClusterInfo[]
  total: number
}

export interface NodeTaint {
  key: string
  value: string | null
  effect: string
}

export interface NodeInfo {
  name: string
  status: string
  roles: string[]
  cpu: ResourceUsage | null
  memory: ResourceUsage | null
  taints: NodeTaint[]
  labels: Record<string, string>
  createdAt: string | null
}

export interface NamespaceInfo {
  name: string
  status: string
  cpuUsage: number
  memoryUsage: number
  podCount: number
  createdAt: string | null
}

export interface DeploymentInfo {
  name: string
  namespace: string
  replicas: number
  readyReplicas: number
  availableReplicas: number
  status: 'Running' | 'Pending' | 'Failed'
  image: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface PodInfo {
  name: string
  status: string
  containers: { name: string }[]
}

export interface PodLogEntry {
  podName: string
  containerName: string
  status: string
  logs: string
}

export interface DeploymentLogsResponse {
  deployment: string
  pods: PodLogEntry[]
  totalPods: number
}

export interface ScaleRequest {
  replicas: number
}

export interface ScaleResponse {
  success: boolean
  message: string
  replicas: number
}
