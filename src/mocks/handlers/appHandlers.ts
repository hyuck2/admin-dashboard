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
  app.components.forEach(comp => {
    comp.deployVersion = body.targetVersion
    comp.k8sVersion = body.targetVersion
    comp.syncStatus = 'Synced'
  })
  app.overallSyncStatus = 'Synced'

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

  const component = app.components.find(c => c.name === body.componentName)
  if (!component) return { status: 404, data: { message: '컴포넌트를 찾을 수 없습니다.' } }

  const prevReplica = component.replicaDesired
  component.replicaDesired = body.replicas
  component.replicaCurrent = body.replicas

  // Recalculate totals
  app.totalReplicaCurrent = app.components.reduce((sum, c) => sum + c.replicaCurrent, 0)
  app.totalReplicaDesired = app.components.reduce((sum, c) => sum + c.replicaDesired, 0)

  mockAuditLogs.unshift({
    id: mockAuditLogs.length + 1,
    userId: 1,
    userName,
    action: 'scale',
    menu: 'apps',
    targetType: 'component',
    targetName: body.componentName,
    detail: { appName: body.appName, env: body.env, from: prevReplica, to: body.replicas },
    result: 'success',
    ipAddress: '127.0.0.1',
    createdAt: new Date().toISOString(),
  })

  return { status: 200, data: { message: `${body.componentName} Replica를 ${body.replicas}로 변경했습니다.` } }
}
