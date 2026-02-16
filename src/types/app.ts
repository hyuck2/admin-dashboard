export type SyncStatus = 'Synced' | 'OutOfSync'

export interface AppStatus {
  appName: string
  env: string
  deployVersion: string
  k8sVersion: string
  syncStatus: SyncStatus
  replicaCurrent: number
  replicaDesired: number
}

export interface AppTag {
  tag: string
  createdAt: string
}

export interface RollbackRequest {
  appName: string
  env: string
  targetVersion: string
}

export interface ReplicaChangeRequest {
  appName: string
  env: string
  replicas: number
}
