import Button from '../ui/Button'
import { useLanguage } from '../../i18n/LanguageContext'

interface InsightCardProps {
  insight: string
  isLoading: boolean
  onRefresh: () => void
}

export default function InsightCard({ insight, isLoading, onRefresh }: InsightCardProps) {
  const { t } = useLanguage()

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-sheen-gold/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <img src="/images/Ai-Chat-Bot--Streamline-Plump.png" alt="" width={20} height={20} style={{ filter: 'brightness(0) saturate(100%) invert(67%) sepia(30%) saturate(600%) hue-rotate(5deg)', minWidth: 20, minHeight: 20 }} />
          <h3 className="font-display font-semibold text-sheen-black">{t('aiQuickInsight')}</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh} loading={isLoading}>
          {t('refresh')}
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-4 bg-sheen-cream rounded animate-pulse" />
          ))}
        </div>
      ) : insight ? (
        <div className="text-sm text-sheen-black/80 font-body whitespace-pre-line leading-relaxed">{insight}</div>
      ) : (
        <p className="text-sm text-sheen-muted">{t('clickRefresh')}</p>
      )}
    </div>
  )
}
