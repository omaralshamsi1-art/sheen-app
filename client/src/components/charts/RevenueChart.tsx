import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useLanguage } from '../../i18n/LanguageContext'

interface RevenueChartProps {
  data: { date: string; revenue: number; expenses: number; petty_cash?: number }[]
}

export default function RevenueChart({ data }: RevenueChartProps) {
  const { t } = useLanguage()

  const formatted = data.map(d => ({
    ...d,
    date: d.date.slice(5),
  }))

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-sheen-cream">
      <h3 className="font-display font-semibold text-sheen-black mb-4">{t('revenueVsExpenses7d')}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={formatted} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F5F0E8" />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#A0785A' }} />
          <YAxis tick={{ fontSize: 12, fill: '#A0785A' }} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontFamily: '"DM Sans"' }}
          />
          <Legend />
          <Bar dataKey="revenue" fill="#D4A843" radius={[4, 4, 0, 0]} name={t('revenueLabel')} />
          <Bar dataKey="expenses" fill="#8B4513" radius={[4, 4, 0, 0]} name={t('expensesLabel')} />
          <Bar dataKey="petty_cash" fill="#C0392B" radius={[4, 4, 0, 0]} name="Petty Cash" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
