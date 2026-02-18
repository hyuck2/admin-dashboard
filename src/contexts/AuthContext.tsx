import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import type { User } from '../types/auth'
import { authService } from '../services/authService'

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (userId: string, password: string) => Promise<void>
  logout: () => void
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  updateUser: (user: User) => void
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState(true)

  // Only call getMe on mount (page reload with existing token).
  // After login(), token and user are already set — no need to re-fetch.
  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    if (savedToken) {
      authService.getMe()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('token')
          setToken(null)
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(async (userId: string, password: string) => {
    const response = await authService.login({ userId, password })
    localStorage.setItem('token', response.token)
    setToken(response.token)
    setUser(response.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }, [])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const response = await authService.changePassword({ currentPassword, newPassword })
    setUser(response.user)
  }, [])

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, changePassword, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}
