function ImgIcon({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      width={20}
      height={20}
      style={{ filter: 'brightness(0) invert(1)', opacity: 0.85, minWidth: 20, minHeight: 20 }}
    />
  )
}

export function DashboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  )
}

export function SalesIcon() {
  return <ImgIcon src="/images/Coffee-Mug--Streamline-Plump.png" alt="Sales" />
}

export function ExpensesIcon() {
  return <ImgIcon src="/images/Money-Outgoing-Expense--Streamline-Plump.png" alt="Expenses" />
}

export function FixedCostsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21H21" />
      <path d="M5 21V7L12 3L19 7V21" />
      <rect x="9" y="13" width="6" height="8" />
      <rect x="9" y="9" width="2" height="2" />
      <rect x="13" y="9" width="2" height="2" />
    </svg>
  )
}

export function MenuIcon() {
  return <ImgIcon src="/images/List--Streamline-Plump.png" alt="Menu" />
}

export function AIMonitorIcon() {
  return <ImgIcon src="/images/Ai-Chat-Bot--Streamline-Plump.png" alt="AI Monitor" />
}

export function ReportsIcon() {
  return <ImgIcon src="/images/Script-2--Streamline-Plump.png" alt="Reports" />
}

export function UsersIcon() {
  return <ImgIcon src="/images/Users-Group-Check--Streamline-Plump.png" alt="Users" />
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
