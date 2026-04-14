import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useLanguage } from '../../i18n/LanguageContext'

interface RevenueChartProps {
  data: { date: string; revenue: number; expenses: number; petty_cash?: number }[]
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function RevenueChart({ data }: RevenueChartProps) {
  const { t } = useLanguage()

  const formatted = data.map(d => {
    // d.date is YYYY-MM-DD — parse as local date (not UTC) to avoid
    // day-of-week drift across time zones.
    const [y, m, day] = d.date.split('-').map(Number)
    const dow = new Date(y, m - 1, day).getDay()
    return {
      ...d,
      label: `${DAYS[dow]}\n${d.date.slice(5)}`, // "Mon\n04-14"
    }
  })

  // Custom tick so each X-axis label shows day name on top line,
  // date on the second line.
  const DayTick = ({ x, y, payload }: any) => {
    const [dayName, dateStr] = (payload.value as string).split('\n')
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={12} textAnchor="middle" fill="#8B4513" fontSize={11} fontWeight={600}>
          {dayName}
        </text>
        <text x={0} y={0} dy={26} textAnchor="middle" fill="#A0785A" fontSize={10}>
          {dateStr}
        </text>
      </g>
    )
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={formatted} barGap={4} margin={{ top: 5, right: 5, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F5F0E8" />
          <XAxis dataKey="label" tick={<DayTick />} interval={0} height={40} />
          <YAxis tick={{ fontSize: 12, fill: '#A0785A' }} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontFamily: '"DM Sans"' }}
            labelFormatter={(label) => typeof label === 'string' ? label.replace('\n', ' • ') : label}
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
