import type { User } from '../types/auth'

/**
 * Check if user has permission for a specific page
 */
export function hasPageAccess(user: User | null, pageId: string): boolean {
  if (!user) return false

  // Admins have access to all pages
  if (user.role === 'admin') return true

  // Check for page_access permission with read action
  return user.permissions.some(
    (p) => p.type === 'page_access' && p.target === pageId && p.action === 'read'
  )
}

/**
 * Check if user has specific permission
 */
export function hasPermission(
  user: User | null,
  type: string,
  target: string,
  action: string
): boolean {
  if (!user) return false

  // Admins have all permissions
  if (user.role === 'admin') return true

  return user.permissions.some(
    (p) => p.type === type && p.target === target && p.action === action
  )
}
