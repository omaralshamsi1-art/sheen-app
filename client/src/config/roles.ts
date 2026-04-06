import type { UserRole } from '../types'
import type { TranslationKey } from '../i18n/translations'

export interface NavItem {
  to: string
  labelKey: TranslationKey
  icon: string
  roles: UserRole[] // which roles can see this nav item
}

export const navItems: NavItem[] = [
  { to: '/dashboard',  labelKey: 'dashboard',  icon: '\u{1F4CA}', roles: ['admin', 'staff'] },
  { to: '/sales',      labelKey: 'sales',      icon: '\u2615',     roles: ['admin', 'staff'] },
  { to: '/expenses',   labelKey: 'expenses',   icon: '\u{1F4B8}', roles: ['admin', 'staff'] },
  { to: '/fixed-costs',labelKey: 'fixedCosts',  icon: '\u{1F3E0}', roles: ['admin'] },
  { to: '/menu',       labelKey: 'menu',       icon: '\u{1F4CB}', roles: ['admin', 'staff', 'customer'] },
  { to: '/ai-monitor', labelKey: 'aiMonitor',  icon: '\u{1F916}', roles: ['admin', 'staff'] },
  { to: '/reports',    labelKey: 'reports',    icon: '\u{1F4C8}', roles: ['admin'] },
  { to: '/users',      labelKey: 'users' as TranslationKey, icon: '\u{1F465}', roles: ['admin'] },
]

// Which roles can access which routes
export const routeRoles: Record<string, UserRole[]> = {
  '/dashboard':   ['admin', 'staff'],
  '/sales':       ['admin', 'staff'],
  '/expenses':    ['admin', 'staff'],
  '/fixed-costs': ['admin'],
  '/menu':        ['admin', 'staff', 'customer'],
  '/ai-monitor':  ['admin', 'staff'],
  '/reports':     ['admin'],
  '/users':       ['admin'],
}

// Default landing page per role
export const defaultRoute: Record<UserRole, string> = {
  admin: '/dashboard',
  staff: '/sales',
  customer: '/menu',
}
