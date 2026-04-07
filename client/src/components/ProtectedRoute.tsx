import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'
import { routeRoles, defaultRoute } from '../config/roles'
import { useLanguage } from '../i18n/LanguageContext'
import type { UserRole } from '../types'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, loading } = useAuth()
  const { role, roleLoading, allowedPages } = useRole()
  const location = useLocation()
  const { t } = useLanguage()

  if (loading || roleLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-sheen-cream">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-sheen-brown border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-body text-sheen-muted">{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  // Check role access for current route
  if (role) {
    const path = location.pathname
    const allowedRoles = routeRoles[path]
    if (allowedRoles && !allowedRoles.includes(role)) {
      return <Navigate to={defaultRoute[role as UserRole]} replace />
    }
    // Staff: check per-user allowed_pages if set
    if (role === 'staff' && allowedPages && allowedPages.length > 0) {
      if (!allowedPages.includes(path)) {
        return <Navigate to={allowedPages[0] || defaultRoute.staff} replace />
      }
    }
  }

  return <>{children}</>
}
