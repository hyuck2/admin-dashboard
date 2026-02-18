import type { User } from '../../types/auth'
import type { Group, Permission } from '../../types/user'

export const mockPermissions: Permission[] = [
  { id: 1, type: 'app_deploy', target: 'app1', action: 'write' },
  { id: 2, type: 'app_deploy', target: 'app2', action: 'write' },
  { id: 3, type: 'page_access', target: 'apps', action: 'read' },
  { id: 5, type: 'page_access', target: 'users', action: 'read' },
  { id: 6, type: 'page_access', target: 'users', action: 'write' },
  { id: 7, type: 'page_access', target: 'audit', action: 'read' },
]

export const mockGroups: Group[] = [
  {
    id: 1,
    name: '관리자',
    description: '전체 시스템 관리 권한',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    permissions: [1, 2, 3, 5, 6, 7],
    members: [1],
  },
  {
    id: 2,
    name: '개발팀',
    description: 'UI 앱 배포 및 조회 권한',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
    permissions: [1, 2, 3],
    members: [2],
  },
  {
    id: 3,
    name: '운영팀',
    description: '앱 조회 및 감사 로그 조회 권한',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
    permissions: [3, 7],
    members: [3],
  },
]

export const mockUsers: User[] = [
  {
    id: 1,
    userId: 'admin',
    department: '플랫폼팀',
    role: 'admin',
    isActive: true,
    passwordChanged: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    groups: [1],
    permissions: mockPermissions,
  },
  {
    id: 2,
    userId: 'dev_user',
    department: '개발팀',
    role: 'user',
    isActive: true,
    passwordChanged: true,
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
    groups: [2],
    permissions: [mockPermissions[0], mockPermissions[1], mockPermissions[2]],
  },
  {
    id: 3,
    userId: 'ops_user',
    department: '운영팀',
    role: 'user',
    isActive: true,
    passwordChanged: true,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
    groups: [3],
    permissions: [mockPermissions[2], mockPermissions[5]],
  },
]

export const mockPasswords: Record<string, string> = {
  admin: 'admin',
  dev_user: 'devpass',
  ops_user: 'opspass',
}
