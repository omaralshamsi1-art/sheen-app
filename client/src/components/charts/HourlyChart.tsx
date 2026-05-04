import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useLanguage } from '../../i18n/LanguageContext'
import type { HourlySales } from '../../types'

interface HourlyChartProps {
  data: HourlySales[]
  onBarClick?: (hour: number) => void
}

export default function HourlyChart({ data, onBarClick }: HourlyChartProps) {
  const { t } = useLanguage()

  const hours = Array.from({ length: 17 }, (_, i) => i + 6)
  const filled = hours.map(hour => ({
    hour: `${hour}:00`,
    hourNum: hour,
    cups: data.find(d => d.hour === hour)?.cups ?? 0,
  }))

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-sheen-cream">
      <h3 className="font-display font-semibold text-sheen-black mb-4">{t('hourlySales')}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={filled}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F5F0E8" />
          <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#A0785A' }} interval={1} />
          <YAxis tick={{ fontSize: 12, fill: '#A0785A' }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontFamily: '"DM Sans"' }}
          />
          <Bar
            dataKey="cups"
            fill="#D4A843"
            radius={[4, 4, 0, 0]}
            name={t('cupsLabel')}
            cursor={onBarClick ? 'pointer' : 'default'}
            onClick={(payload: any) => {
              if (onBarClick && payload && typeof payload.hourNum === 'number' && payload.cups > 0) {
                onBarClick(payload.hourNum)
              }
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
