export interface User {
  id: number
  userId: string
  department: string
  role: 'admin' | 'user'
  isActive: boolean
  passwordChanged: boolean
  createdAt: string
  updatedAt: string
  groups: number[]
}

export interface LoginRequest {
  userId: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}
