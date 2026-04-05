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
    <header className="bg-white border-b border-sheen-cream px-6 py-4 flex items-center justify-between">
      <h1 className="font-display text-xl font-semibold text-sheen-black">{title}</h1>
      <div className="text-sm font-body text-sheen-muted">
        {dateStr}
      </div>
    </header>
  )
}
