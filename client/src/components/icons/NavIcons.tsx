const cn = "w-5 h-5"

export function DashboardIcon() {
  return (
    <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  )
}

export function SalesIcon() {
  return (
    <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 8C17 10.76 14.76 13 12 13C9.24 13 7 10.76 7 8C7 5.24 9.24 3 12 3C14.76 3 17 5.24 17 8Z" />
      <path d="M12 13V17" />
      <path d="M8 21H16" />
      <path d="M12 17V21" />
      <path d="M7 8H3" />
      <path d="M21 8H17" />
    </svg>
  )
}

export function ExpensesIcon() {
  return (
    <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <path d="M2 10H22" />
      <path d="M6 14H10" />
    </svg>
  )
}

export function FixedCostsIcon() {
  return (
    <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21H21" />
      <path d="M5 21V7L12 3L19 7V21" />
      <rect x="9" y="13" width="6" height="8" />
      <rect x="9" y="9" width="2" height="2" />
      <rect x="13" y="9" width="2" height="2" />
    </svg>
  )
}

export function MenuIcon() {
  return (
    <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4H20V16C20 18.21 18.21 20 16 20H8C5.79 20 4 18.21 4 16V4Z" />
      <path d="M4 4C4 4 4.5 9 12 9C19.5 9 20 4 20 4" />
      <path d="M12 9V20" />
    </svg>
  )
}

export function AIMonitorIcon() {
  return (
    <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.48 2 2 6 2 10.5C2 15 6.48 19 12 19H12.5L17 22V18.5C20 17 22 14 22 10.5C22 6 17.52 2 12 2Z" />
      <circle cx="8" cy="10.5" r="1" fill="currentColor" />
      <circle cx="12" cy="10.5" r="1" fill="currentColor" />
      <circle cx="16" cy="10.5" r="1" fill="currentColor" />
    </svg>
  )
}

export function ReportsIcon() {
  return (
    <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 21H4C3.45 21 3 20.55 3 20V3" />
      <path d="M7 17L12 11L16 14L21 8" />
      <path d="M18 8H21V11" />
    </svg>
  )
}

export function UsersIcon() {
  return (
    <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21V19C3 16.79 4.79 15 7 15H11C13.21 15 15 16.79 15 19V21" />
      <path d="M16 3.13C17.8 3.69 19 5.36 19 7.25C19 9.14 17.8 10.81 16 11.37" />
      <path d="M21 21V19C21 17.14 19.82 15.5 18 14.93" />
    </svg>
  )
}

export const navIconMap: Record<string, () => JSX.Element> = {
  '/dashboard': DashboardIcon,
  '/sales': SalesIcon,
  '/expenses': ExpensesIcon,
  '/fixed-costs': FixedCostsIcon,
  '/menu': MenuIcon,
  '/ai-monitor': AIMonitorIcon,
  '/reports': ReportsIcon,
  '/users': UsersIcon,
}
