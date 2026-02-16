import type { AppStatus, AppTag } from '../../types/app'

export const mockApps: AppStatus[] = [
  {
    appName: 'app1',
    env: 'prod',
    deployVersion: 'v0.1.0',
    k8sVersion: 'v0.1.0',
    syncStatus: 'Synced',
    replicaCurrent: 1,
    replicaDesired: 1,
  },
  {
    appName: 'app1',
    env: 'stage',
    deployVersion: 'v0.1.1rc1',
    k8sVersion: 'v0.1.1rc1',
    syncStatus: 'Synced',
    replicaCurrent: 1,
    replicaDesired: 1,
  },
  {
    appName: 'app2',
    env: 'prod',
    deployVersion: 'v0.1.0',
    k8sVersion: 'v0.1.0',
    syncStatus: 'Synced',
    replicaCurrent: 1,
    replicaDesired: 1,
  },
  {
    appName: 'app2',
    env: 'stage',
    deployVersion: 'v0.1.0rc1',
    k8sVersion: '-',
    syncStatus: 'OutOfSync',
    replicaCurrent: 0,
    replicaDesired: 1,
  },
]

export const mockTags: Record<string, AppTag[]> = {
  app1: [
    { tag: 'v0.1.0', createdAt: '2026-02-10T10:00:00Z' },
    { tag: 'v0.1.1', createdAt: '2026-02-15T10:00:00Z' },
  ],
  app2: [
    { tag: 'v0.1.0', createdAt: '2026-02-12T10:00:00Z' },
  ],
}
