import type { UserRole } from '../types'
import type { TranslationKey } from '../i18n/translations'

export interface NavItem {
  to: string
  labelKey: TranslationKey
  icon: string
  roles: UserRole[] // which roles can see this nav item
}

export const navItems: NavItem[] = [
  { to: '/dashboard',  labelKey: 'dashboard',  icon: '', roles: ['admin', 'staff'] },
  { to: '/sales',      labelKey: 'sales',      icon: '', roles: ['admin', 'staff'] },
  { to: '/expenses',   labelKey: 'expenses',   icon: '', roles: ['admin', 'staff'] },
  { to: '/fixed-costs',labelKey: 'fixedCosts',  icon: '', roles: ['admin'] },
  { to: '/menu',       labelKey: 'menu',       icon: '', roles: ['admin', 'staff'] },
  { to: '/order',      labelKey: 'orderNow' as TranslationKey, icon: '', roles: ['customer'] },
  { to: '/orders',     labelKey: 'orders' as TranslationKey, icon: '', roles: ['admin', 'staff'] },
  { to: '/ai-monitor', labelKey: 'aiMonitor',  icon: '', roles: ['admin', 'staff'] },
  { to: '/reports',    labelKey: 'reports',    icon: '', roles: ['admin'] },
  { to: '/users',      labelKey: 'users' as TranslationKey, icon: '', roles: ['admin'] },
  { to: '/petty-cash',  labelKey: 'pettyCash' as TranslationKey, icon: '', roles: ['admin', 'staff'] },
  { to: '/my-card',      labelKey: 'myCard' as TranslationKey, icon: '', roles: ['customer'] },
  { to: '/loyalty-scan', labelKey: 'loyaltyScan' as TranslationKey, icon: '', roles: ['admin', 'staff'] },
  { to: '/ingredients', labelKey: 'ingredients' as TranslationKey, icon: '', roles: ['admin'] },
  { to: '/stickers',    labelKey: 'stickerMessages' as TranslationKey, icon: '', roles: ['admin'] },
  { to: '/settings',   labelKey: 'settings' as TranslationKey, icon: '', roles: ['admin'] },
  { to: '/audit-log',  labelKey: 'auditLog' as TranslationKey, icon: '', roles: ['admin'] },
]

// Which roles can access which routes
export const routeRoles: Record<string, UserRole[]> = {
  '/dashboard':   ['admin', 'staff'],
  '/sales':       ['admin', 'staff'],
  '/expenses':    ['admin', 'staff'],
  '/fixed-costs': ['admin'],
  '/menu':        ['admin', 'staff'],
  '/order':       ['customer'],
  '/orders':      ['admin', 'staff'],
  '/ai-monitor':  ['admin', 'staff'],
  '/reports':     ['admin'],
  '/users':       ['admin'],
  '/petty-cash':    ['admin', 'staff'],
  '/my-card':       ['customer'],
  '/loyalty-scan':  ['admin', 'staff'],
  '/ingredients':  ['admin'],
  '/stickers':     ['admin'],
  '/settings':     ['admin'],
  '/audit-log':   ['admin'],
}

// Default landing page per role
export const defaultRoute: Record<UserRole, string> = {
  admin: '/dashboard',
  staff: '/sales',
  customer: '/order',
}
