function NavImg({ src, alt }: { src: string; alt: string }) {
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
  return <NavImg src="/images/Speedometer-Outline--Streamline-Ionic-Outline.svg" alt="Dashboard" />
}

export function SalesIcon() {
  return <NavImg src="/images/Cafe-Outline--Streamline-Ionic-Outline.svg" alt="Sales" />
}

export function ExpensesIcon() {
  return <NavImg src="/images/Receipt-Outline--Streamline-Ionic-Outline.svg" alt="Expenses" />
}

export function FixedCostsIcon() {
  return <NavImg src="/images/Storefront-Outline--Streamline-Ionic-Outline.svg" alt="Fixed Costs" />
}

export function MenuIcon() {
  return <NavImg src="/images/Newspaper-Outline--Streamline-Ionic-Outline.svg" alt="Menu" />
}

export function AIMonitorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.48 2 2 6 2 10.5C2 15 6.48 19 12 19H12.5L17 22V18.5C20 17 22 14 22 10.5C22 6 17.52 2 12 2Z" />
      <circle cx="8" cy="10.5" r="1" fill="currentColor" />
      <circle cx="12" cy="10.5" r="1" fill="currentColor" />
      <circle cx="16" cy="10.5" r="1" fill="currentColor" />
    </svg>
  )
}

export function ReportsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 21H4C3.45 21 3 20.55 3 20V3" />
      <path d="M7 17L12 11L16 14L21 8" />
      <path d="M18 8H21V11" />
    </svg>
  )
}

export function UsersIcon() {
  return <NavImg src="/images/People-Circle-Outline--Streamline-Ionic-Outline.svg" alt="Users" />
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
