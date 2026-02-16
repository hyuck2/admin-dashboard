import { handleLogin, handleChangePassword, handleGetMe } from '../mocks/handlers/authHandlers'
import { handleGetApps, handleGetTags, handleRollback, handleChangeReplica } from '../mocks/handlers/appHandlers'
import {
  handleGetUsers, handleCreateUser, handleUpdateUser, handleDeleteUser,
  handleGetGroups, handleCreateGroup, handleUpdateGroup, handleDeleteGroup,
  handleGetPermissions,
} from '../mocks/handlers/userHandlers'
import { handleGetAuditLogs } from '../mocks/handlers/auditHandlers'

interface RouteParams {
  body?: unknown
  query?: Record<string, string>
  pathParams?: string[]
}

interface ApiResponse {
  status: number
  data: unknown
}

function getCurrentUserId(): string {
  const token = localStorage.getItem('token')
  if (!token) return ''
  try {
    const payload = JSON.parse(atob(token))
    return payload.userId ?? ''
  } catch {
    return ''
  }
}

function delay(ms = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function matchRoute(method: string, path: string, params: RouteParams): ApiResponse | null {
  const { body, query, pathParams } = params

  if (method === 'POST' && path === '/auth/login')
    return handleLogin(body as Parameters<typeof handleLogin>[0])
  if (method === 'POST' && path === '/auth/change-password')
    return handleChangePassword(body as Parameters<typeof handleChangePassword>[0], getCurrentUserId())
  if (method === 'GET' && path === '/auth/me')
    return handleGetMe(getCurrentUserId())
  if (method === 'GET' && path === '/apps')
    return handleGetApps()
  if (method === 'GET' && path === '/apps/tags')
    return handleGetTags(query?.appName ?? '')
  if (method === 'POST' && path === '/apps/rollback')
    return handleRollback(body as Parameters<typeof handleRollback>[0], getCurrentUserId())
  if (method === 'POST' && path === '/apps/replica')
    return handleChangeReplica(body as Parameters<typeof handleChangeReplica>[0], getCurrentUserId())
  if (method === 'GET' && path === '/users')
    return handleGetUsers()
  if (method === 'POST' && path === '/users')
    return handleCreateUser(body as Parameters<typeof handleCreateUser>[0], getCurrentUserId())
  if (method === 'PUT' && path === '/users')
    return handleUpdateUser(Number(pathParams?.[0]), body as Parameters<typeof handleUpdateUser>[1], getCurrentUserId())
  if (method === 'DELETE' && path === '/users')
    return handleDeleteUser(Number(pathParams?.[0]), getCurrentUserId())
  if (method === 'GET' && path === '/groups')
    return handleGetGroups()
  if (method === 'POST' && path === '/groups')
    return handleCreateGroup(body as Parameters<typeof handleCreateGroup>[0], getCurrentUserId())
  if (method === 'PUT' && path === '/groups')
    return handleUpdateGroup(Number(pathParams?.[0]), body as Parameters<typeof handleUpdateGroup>[1], getCurrentUserId())
  if (method === 'DELETE' && path === '/groups')
    return handleDeleteGroup(Number(pathParams?.[0]), getCurrentUserId())
  if (method === 'GET' && path === '/permissions')
    return handleGetPermissions()
  if (method === 'GET' && path === '/audit-logs')
    return handleGetAuditLogs({
      startDate: query?.startDate,
      endDate: query?.endDate,
      userId: query?.userId ? Number(query.userId) : undefined,
      menu: query?.menu,
      action: query?.action,
      page: Number(query?.page ?? 1),
      pageSize: Number(query?.pageSize ?? 10),
    })

  return null
}

export async function apiClient<T = unknown>(
  method: string,
  path: string,
  options?: { body?: unknown; query?: Record<string, string>; pathParams?: string[] },
): Promise<T> {
  await delay()

  const result = matchRoute(method.toUpperCase(), path, {
    body: options?.body,
    query: options?.query,
    pathParams: options?.pathParams,
  })

  if (!result) {
    throw new Error(`Mock route not found: ${method} ${path}`)
  }

  if (result.status >= 400) {
    throw new ApiError(result.status, (result.data as { message?: string }).message ?? 'Error')
  }

  return result.data as T
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}
