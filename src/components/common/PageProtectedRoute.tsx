import { Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { hasPageAccess } from '../../utils/permissions'

interface PageProtectedRouteProps {
  children: React.ReactNode
  pageId: string
}

/**
 * Protects individual page routes based on page_access permissions.
 * Redirects to home if user doesn't have access to the specific page.
 * Use inside the main ProtectedRoute (after auth check).
 */
export default function PageProtectedRoute({ children, pageId }: PageProtectedRouteProps) {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Home page is always accessible
  if (pageId === 'home') {
    return <>{children}</>
  }

  // Check if user has permission to access this page
  if (!hasPageAccess(user, pageId)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
