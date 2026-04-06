import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { useLanguage } from '../../i18n/LanguageContext'

interface TopBarProps {
  title: string
}

export default function TopBar({ title }: TopBarProps) {
  const { lang } = useLanguage()
  const today = new Date()
  const dateStr = lang === 'ar'
    ? format(today, 'EEEE, d MMMM yyyy', { locale: ar })
    : format(today, 'EEEE, MMMM d, yyyy')

  return (
    <header
      className="bg-white border-b border-sheen-cream pl-14 pr-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-20 w-full"
      style={{ paddingTop: 'max(0.75rem, calc(0.75rem + env(safe-area-inset-top)))' }}
    >
      <h1 className="font-display text-lg sm:text-xl font-semibold text-sheen-black">{title}</h1>
      <div className="hidden sm:block text-sm font-body text-sheen-muted">
        {dateStr}
      </div>
    </header>
  )
}
