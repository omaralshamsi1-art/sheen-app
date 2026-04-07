import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { useLanguage } from '../i18n/LanguageContext'

interface StockItem {
  id: string
  name: string
  category: string
  unit: string
  purchased: number
  used: number
  remaining: number
  low_stock: boolean
}

export default function StockAlert() {
  const { t } = useLanguage()

  const { data: stock = [], isLoading } = useQuery<StockItem[]>({
    queryKey: ['ingredients', 'stock'],
    queryFn: async () => {
      const { data } = await api.get('/api/ingredients/stock')
      return data
    },
    staleTime: 60_000,
  })

  const lowStockItems = stock.filter((s) => s.low_stock || s.remaining <= 0)
  const hasRecipeData = stock.some((s) => s.used > 0)

  if (isLoading) return null
  if (!hasRecipeData && lowStockItems.length === 0) return null

  return (
    <div className="bg-sheen-white rounded-xl shadow-sm p-5">
      <h2 className="font-display text-lg text-sheen-black mb-4">{t('stockLevels')}</h2>

      {lowStockItems.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="font-body text-sm font-semibold text-red-700 mb-2">
            {'\u{26A0}'} {t('restockNeeded')}
          </p>
          <div className="flex flex-wrap gap-2">
            {lowStockItems.map((item) => (
              <span
                key={item.id}
                className="px-2.5 py-1 rounded-full text-xs font-body font-medium bg-red-100 text-red-700"
              >
                {item.name} — {item.remaining.toFixed(0)} {item.unit} {t('remaining')}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm font-body">
          <thead>
            <tr className="text-left text-xs text-sheen-muted uppercase border-b border-sheen-cream">
              <th className="pb-2 pr-3">{t('ingredient')}</th>
              <th className="pb-2 pr-3">{t('category')}</th>
              <th className="pb-2 pr-3 text-right">{t('purchased')}</th>
              <th className="pb-2 pr-3 text-right">{t('used')}</th>
              <th className="pb-2 text-right">{t('remaining')}</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((item) => (
              <tr
                key={item.id}
                className={`border-b border-sheen-muted/10 ${item.low_stock ? 'bg-red-50' : ''}`}
              >
                <td className="py-2 pr-3 text-sheen-black font-medium">
                  {item.name}
                  {item.low_stock && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">
                      {t('lowStock')}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 text-sheen-muted">{item.category}</td>
                <td className="py-2 pr-3 text-right text-sheen-black">{item.purchased.toFixed(1)} {item.unit}</td>
                <td className="py-2 pr-3 text-right text-sheen-black">{item.used.toFixed(1)} {item.unit}</td>
                <td className={`py-2 text-right font-semibold ${item.remaining <= 0 ? 'text-red-600' : item.low_stock ? 'text-orange-600' : 'text-green-600'}`}>
                  {item.remaining.toFixed(1)} {item.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
