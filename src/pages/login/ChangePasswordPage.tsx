import { useState, type FormEvent } from 'react'
import { useAuth } from '../../hooks/useAuth'

export default function ChangePasswordPage() {
  const { changePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.')
      return
    }
    if (newPassword.length < 4) {
      setError('비밀번호는 4자 이상이어야 합니다.')
      return
    }

    setLoading(true)
    try {
      await changePassword(currentPassword, newPassword)
    } catch (err) {
      setError(err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-secondary">
      <div className="w-full max-w-sm bg-bg-primary rounded-lg border border-border-primary shadow-sm p-6">
        <h1 className="text-lg font-semibold text-text-primary text-center mb-2">
          비밀번호 변경
        </h1>
        <p className="text-xs text-text-secondary text-center mb-6">
          최초 로그인 시 비밀번호를 변경해야 합니다.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              현재 비밀번호
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-bg-primary text-text-primary border border-border-secondary rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              새 비밀번호
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-bg-primary text-text-primary border border-border-secondary rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              새 비밀번호 확인
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-bg-primary text-text-primary border border-border-secondary rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
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
            {loading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </div>
    </div>
  )
}
