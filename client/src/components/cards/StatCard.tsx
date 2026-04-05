interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
}

export default function StatCard({ title, value, subtitle, icon, trend }: StatCardProps) {
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-sheen-muted'

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-sheen-cream hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-sheen-muted font-body">{title}</p>
          <p className="text-2xl font-display font-bold text-sheen-black mt-1">{value}</p>
          {subtitle && <p className={`text-xs mt-1 font-body ${trendColor}`}>{subtitle}</p>}
        </div>
        <div className="w-10 h-10 rounded-lg bg-sheen-gold/10 flex items-center justify-center text-sheen-gold">
          {icon}
        </div>
      </div>
    </div>
  )
}
