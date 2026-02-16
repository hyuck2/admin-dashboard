export interface Group {
  id: number
  name: string
  description: string
  createdAt: string
  updatedAt: string
  permissions: number[]
  members: number[]
}

export interface Permission {
  id: number
  type: 'app_deploy' | 'page_access'
  target: string
  action: 'read' | 'write'
}

export interface CreateUserRequest {
  userId: string
  password: string
  department: string
  role: 'admin' | 'user'
  groups: number[]
}

export interface UpdateUserRequest {
  department?: string
  role?: 'admin' | 'user'
  isActive?: boolean
  groups?: number[]
}

export interface CreateGroupRequest {
  name: string
  description: string
  permissions: number[]
}

export interface UpdateGroupRequest {
  name?: string
  description?: string
  permissions?: number[]
}
