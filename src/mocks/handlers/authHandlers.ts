import { mockUsers, mockPasswords } from '../data/users'
import type { LoginRequest, ChangePasswordRequest, User } from '../../types/auth'

const users = [...mockUsers]
const passwords = { ...mockPasswords }

function generateToken(user: User) {
  return btoa(JSON.stringify({ userId: user.userId, role: user.role, exp: Date.now() + 3600000 }))
}

export function handleLogin(body: LoginRequest) {
  const user = users.find((u) => u.userId === body.userId && u.isActive)
  if (!user || passwords[user.userId] !== body.password) {
    return { status: 401, data: { message: '아이디 또는 비밀번호가 올바르지 않습니다.' } }
  }
  return { status: 200, data: { token: generateToken(user), user } }
}

export function handleChangePassword(body: ChangePasswordRequest, currentUserId: string) {
  const user = users.find((u) => u.userId === currentUserId)
  if (!user) return { status: 404, data: { message: '사용자를 찾을 수 없습니다.' } }
  if (passwords[user.userId] !== body.currentPassword) {
    return { status: 400, data: { message: '현재 비밀번호가 올바르지 않습니다.' } }
  }
  passwords[user.userId] = body.newPassword
  user.passwordChanged = true
  user.updatedAt = new Date().toISOString()
  return { status: 200, data: { message: '비밀번호가 변경되었습니다.', user } }
}

export function handleGetMe(currentUserId: string) {
  const user = users.find((u) => u.userId === currentUserId)
  if (!user) return { status: 404, data: { message: '사용자를 찾을 수 없습니다.' } }
  return { status: 200, data: user }
}

export function getUsers() {
  return users
}

export function getPasswords() {
  return passwords
}
