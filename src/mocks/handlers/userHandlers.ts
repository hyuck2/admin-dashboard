import { getUsers, getPasswords } from './authHandlers'
import { mockGroups, mockPermissions } from '../data/users'
import { mockAuditLogs } from '../data/auditLogs'
import type { CreateUserRequest, UpdateUserRequest, CreateGroupRequest, UpdateGroupRequest } from '../../types/user'

const groups = [...mockGroups]
const permissions = [...mockPermissions]

export function handleGetUsers() {
  return { status: 200, data: getUsers() }
}

export function handleCreateUser(body: CreateUserRequest, actorName: string) {
  const users = getUsers()
  const passwords = getPasswords()
  if (users.find((u) => u.userId === body.userId)) {
    return { status: 400, data: { message: '이미 존재하는 사용자 ID입니다.' } }
  }
  const newUser = {
    id: users.length + 1,
    userId: body.userId,
    department: body.department,
    role: body.role,
    isActive: true,
    passwordChanged: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    groups: body.groups ?? [],
  }
  users.push(newUser)
  passwords[body.userId] = body.password

  mockAuditLogs.unshift({
    id: mockAuditLogs.length + 1,
    userId: 1, userName: actorName, action: 'create', menu: 'users',
    targetType: 'user', targetName: body.userId,
    detail: { department: body.department, role: body.role },
    result: 'success', ipAddress: '127.0.0.1', createdAt: new Date().toISOString(),
  })

  return { status: 201, data: newUser }
}

export function handleUpdateUser(userId: number, body: UpdateUserRequest, actorName: string) {
  const users = getUsers()
  const user = users.find((u) => u.id === userId)
  if (!user) return { status: 404, data: { message: '사용자를 찾을 수 없습니다.' } }

  const changes: Record<string, unknown> = {}
  if (body.department !== undefined) { changes.department = { from: user.department, to: body.department }; user.department = body.department }
  if (body.role !== undefined) { changes.role = { from: user.role, to: body.role }; user.role = body.role }
  if (body.isActive !== undefined) { changes.isActive = { from: user.isActive, to: body.isActive }; user.isActive = body.isActive }
  if (body.groups !== undefined) { changes.groups = { from: user.groups, to: body.groups }; user.groups = body.groups }
  user.updatedAt = new Date().toISOString()

  mockAuditLogs.unshift({
    id: mockAuditLogs.length + 1,
    userId: 1, userName: actorName, action: 'update', menu: 'users',
    targetType: 'user', targetName: user.userId,
    detail: changes,
    result: 'success', ipAddress: '127.0.0.1', createdAt: new Date().toISOString(),
  })

  return { status: 200, data: user }
}

export function handleDeleteUser(userId: number, actorName: string) {
  const users = getUsers()
  const idx = users.findIndex((u) => u.id === userId)
  if (idx === -1) return { status: 404, data: { message: '사용자를 찾을 수 없습니다.' } }
  const [removed] = users.splice(idx, 1)

  mockAuditLogs.unshift({
    id: mockAuditLogs.length + 1,
    userId: 1, userName: actorName, action: 'delete', menu: 'users',
    targetType: 'user', targetName: removed.userId,
    detail: {},
    result: 'success', ipAddress: '127.0.0.1', createdAt: new Date().toISOString(),
  })

  return { status: 200, data: { message: '사용자가 삭제되었습니다.' } }
}

export function handleGetGroups() {
  return { status: 200, data: groups }
}

export function handleCreateGroup(body: CreateGroupRequest, actorName: string) {
  if (groups.find((g) => g.name === body.name)) {
    return { status: 400, data: { message: '이미 존재하는 그룹명입니다.' } }
  }
  const newGroup = {
    id: groups.length + 1,
    name: body.name,
    description: body.description,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    permissions: body.permissions ?? [],
    members: [],
  }
  groups.push(newGroup)

  mockAuditLogs.unshift({
    id: mockAuditLogs.length + 1,
    userId: 1, userName: actorName, action: 'create', menu: 'users',
    targetType: 'group', targetName: body.name,
    detail: { permissions: body.permissions },
    result: 'success', ipAddress: '127.0.0.1', createdAt: new Date().toISOString(),
  })

  return { status: 201, data: newGroup }
}

export function handleUpdateGroup(groupId: number, body: UpdateGroupRequest, actorName: string) {
  const group = groups.find((g) => g.id === groupId)
  if (!group) return { status: 404, data: { message: '그룹을 찾을 수 없습니다.' } }

  if (body.name !== undefined) group.name = body.name
  if (body.description !== undefined) group.description = body.description
  if (body.permissions !== undefined) group.permissions = body.permissions
  group.updatedAt = new Date().toISOString()

  mockAuditLogs.unshift({
    id: mockAuditLogs.length + 1,
    userId: 1, userName: actorName, action: 'update', menu: 'users',
    targetType: 'group', targetName: group.name,
    detail: body as Record<string, unknown>,
    result: 'success', ipAddress: '127.0.0.1', createdAt: new Date().toISOString(),
  })

  return { status: 200, data: group }
}

export function handleDeleteGroup(groupId: number, actorName: string) {
  const idx = groups.findIndex((g) => g.id === groupId)
  if (idx === -1) return { status: 404, data: { message: '그룹을 찾을 수 없습니다.' } }
  const [removed] = groups.splice(idx, 1)

  mockAuditLogs.unshift({
    id: mockAuditLogs.length + 1,
    userId: 1, userName: actorName, action: 'delete', menu: 'users',
    targetType: 'group', targetName: removed.name,
    detail: {},
    result: 'success', ipAddress: '127.0.0.1', createdAt: new Date().toISOString(),
  })

  return { status: 200, data: { message: '그룹이 삭제되었습니다.' } }
}

export function handleGetPermissions() {
  return { status: 200, data: permissions }
}
