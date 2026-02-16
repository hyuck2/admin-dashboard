import { mockApps, mockTags } from '../data/apps'
import { mockAuditLogs } from '../data/auditLogs'
import type { RollbackRequest, ReplicaChangeRequest } from '../../types/app'

const apps = [...mockApps]

export function handleGetApps() {
  return { status: 200, data: apps }
}

export function handleGetTags(appName: string) {
  const tags = mockTags[appName] ?? []
  return { status: 200, data: tags }
}

export function handleRollback(body: RollbackRequest, userName: string) {
  const app = apps.find((a) => a.appName === body.appName && a.env === body.env)
  if (!app) return { status: 404, data: { message: '앱을 찾을 수 없습니다.' } }

  const prevVersion = app.deployVersion
  app.deployVersion = body.targetVersion
  app.k8sVersion = body.targetVersion
  app.syncStatus = 'Synced'

  mockAuditLogs.unshift({
    id: mockAuditLogs.length + 1,
    userId: 1,
    userName,
    action: 'rollback',
    menu: 'apps',
    targetType: 'app',
    targetName: `${body.appName}-${body.env}`,
    detail: { from: prevVersion, to: body.targetVersion },
    result: 'success',
    ipAddress: '127.0.0.1',
    createdAt: new Date().toISOString(),
  })

  return { status: 200, data: { message: `${body.appName} ${body.env}를 ${body.targetVersion}으로 롤백했습니다.` } }
}

export function handleChangeReplica(body: ReplicaChangeRequest, userName: string) {
  const app = apps.find((a) => a.appName === body.appName && a.env === body.env)
  if (!app) return { status: 404, data: { message: '앱을 찾을 수 없습니다.' } }

  const prevReplica = app.replicaDesired
  app.replicaDesired = body.replicas
  app.replicaCurrent = body.replicas

  mockAuditLogs.unshift({
    id: mockAuditLogs.length + 1,
    userId: 1,
    userName,
    action: 'scale',
    menu: 'apps',
    targetType: 'app',
    targetName: `${body.appName}-${body.env}`,
    detail: { from: prevReplica, to: body.replicas },
    result: 'success',
    ipAddress: '127.0.0.1',
    createdAt: new Date().toISOString(),
  })

  return { status: 200, data: { message: `${body.appName} ${body.env} Replica를 ${body.replicas}로 변경했습니다.` } }
}
