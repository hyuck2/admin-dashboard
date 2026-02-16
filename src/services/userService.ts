import { apiClient } from './api'
import type { User } from '../types/auth'
import type { Group, Permission, CreateUserRequest, UpdateUserRequest, CreateGroupRequest, UpdateGroupRequest } from '../types/user'

export const userService = {
  getUsers() {
    return apiClient<User[]>('GET', '/users')
  },

  createUser(data: CreateUserRequest) {
    return apiClient<User>('POST', '/users', { body: data })
  },

  updateUser(id: number, data: UpdateUserRequest) {
    return apiClient<User>('PUT', '/users', { body: data, pathParams: [String(id)] })
  },

  deleteUser(id: number) {
    return apiClient<{ message: string }>('DELETE', '/users', { pathParams: [String(id)] })
  },

  getGroups() {
    return apiClient<Group[]>('GET', '/groups')
  },

  createGroup(data: CreateGroupRequest) {
    return apiClient<Group>('POST', '/groups', { body: data })
  },

  updateGroup(id: number, data: UpdateGroupRequest) {
    return apiClient<Group>('PUT', '/groups', { body: data, pathParams: [String(id)] })
  },

  deleteGroup(id: number) {
    return apiClient<{ message: string }>('DELETE', '/groups', { pathParams: [String(id)] })
  },

  getPermissions() {
    return apiClient<Permission[]>('GET', '/permissions')
  },
}
