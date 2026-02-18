import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { ApiError } from '../../services/api'

export default function LoginPage() {
  const { login, user, token } = useAuth()
  const navigate = useNavigate()
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(userId, password)
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError('아이디 또는 비밀번호가 잘못되었습니다.')
        } else if (err.status === 403) {
          setError('비활성화된 계정입니다.')
        } else {
          setError(`서버 오류가 발생했습니다. (${err.status})`)
        }
      } else {
        setError('서버에 연결할 수 없습니다.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (token && user) {
    return <Navigate to={user.passwordChanged ? '/' : '/change-password'} replace />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary">
      <div className="w-full max-w-sm bg-bg-primary rounded-lg border border-border-primary shadow-sm p-6">
        <h1 className="text-lg font-semibold text-text-primary text-center mb-6">
          Admin Dashboard
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              아이디
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-bg-primary text-text-primary border border-border-secondary rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="아이디를 입력하세요"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-bg-primary text-text-primary border border-border-secondary rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>
          {error && (
            <p className="text-xs text-danger">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-3 py-1.5 text-sm font-medium text-text-inverse bg-accent hover:bg-accent-hover rounded-md transition-colors disabled:opacity-50"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
