import { apiClient } from './api'
import type { LoginRequest, LoginResponse, ChangePasswordRequest, User } from '../types/auth'

export const authService = {
  login(data: LoginRequest) {
    return apiClient<LoginResponse>('POST', '/auth/login', { body: data })
  },

  changePassword(data: ChangePasswordRequest) {
    return apiClient<{ message: string; user: User }>('POST', '/auth/change-password', { body: data })
  },

  getMe() {
    return apiClient<User>('GET', '/auth/me')
  },
}
