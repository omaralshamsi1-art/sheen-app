import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { CategoryBreakdown } from '../../types'

interface CategoryPieChartProps {
  data: CategoryBreakdown[]
  title?: string
}

const COLORS = ['#D4A843', '#8B4513', '#A0785A', '#1A1A1A', '#6B7280', '#92400E']

export default function CategoryPieChart({ data, title }: CategoryPieChartProps) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-sheen-cream">
      {title && <h3 className="font-display font-semibold text-sheen-black mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            dataKey="total"
            nameKey="category"
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => Number(value).toFixed(2)}
            contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontFamily: '"DM Sans"' }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
