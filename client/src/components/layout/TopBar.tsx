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
      className="bg-white border-b border-sheen-cream px-4 md:px-6 pb-3 md:pb-4 flex items-center justify-between sticky top-0 z-20 w-full"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
    >
      {/* Spacer for hamburger button on mobile */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-8 h-8 md:hidden shrink-0" aria-hidden="true" />
        <h1 className="font-display text-lg md:text-xl font-semibold text-sheen-black truncate">{title}</h1>
      </div>
      <div className="hidden sm:block text-sm font-body text-sheen-muted shrink-0">
        {dateStr}
      </div>
    </header>
  )
}
