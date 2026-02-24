import type { AppStatus, AppTag } from '../../types/app'

export const mockApps: AppStatus[] = [
  {
    appName: 'app1',
    env: 'prod',
    deployVersion: 'v0.1.0',
    components: [
      {
        name: 'app1-ui',
        deployVersion: 'v0.1.0',
        k8sVersion: 'v0.1.0',
        syncStatus: 'Synced',
        replicaCurrent: 1,
        replicaDesired: 1,
      },
      {
        name: 'app1-api',
        deployVersion: 'v0.1.0',
        k8sVersion: 'v0.1.0',
        syncStatus: 'Synced',
        replicaCurrent: 2,
        replicaDesired: 2,
      },
    ],
    overallSyncStatus: 'Synced',
    totalReplicaCurrent: 3,
    totalReplicaDesired: 3,
  },
  {
    appName: 'app1',
    env: 'stage',
    deployVersion: 'v0.1.1rc1',
    components: [
      {
        name: 'app1-ui',
        deployVersion: 'v0.1.1rc1',
        k8sVersion: 'v0.1.0',
        syncStatus: 'OutOfSync',
        replicaCurrent: 1,
        replicaDesired: 1,
      },
      {
        name: 'app1-api',
        deployVersion: 'v0.1.1rc1',
        k8sVersion: 'v0.1.1rc1',
        syncStatus: 'Synced',
        replicaCurrent: 1,
        replicaDesired: 1,
      },
    ],
    overallSyncStatus: 'OutOfSync',
    totalReplicaCurrent: 2,
    totalReplicaDesired: 2,
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
