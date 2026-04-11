import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { getOrders } from '../services/orderService'
import TopBar from '../components/layout/TopBar'
import { useLanguage } from '../i18n/LanguageContext'
import { format } from 'date-fns'
import type { Order, OrderItem } from '../types'

const statusColor: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  completed: 'bg-blue-100 text-blue-700',
  closed: 'bg-gray-100 text-gray-500',
}

export default function MyOrders() {
  const { t } = useLanguage()
  const { user } = useAuth()

  const { data: myOrders = [], isLoading } = useQuery({
    queryKey: ['orders', 'mine', user?.id],
    queryFn: () => getOrders({ customer_id: user?.id }),
    enabled: !!user?.id,
  })

  return (
    <div className="min-h-screen bg-sheen-cream overflow-x-hidden">
      <TopBar title={t('myOrders')} />

      <main className="max-w-2xl mx-auto px-4 py-6">
        {isLoading ? (
          <p className="text-center text-sheen-muted font-body py-12">Loading…</p>
        ) : myOrders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">☕</p>
            <p className="font-body text-sheen-muted">No orders yet. Place your first order!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myOrders.map((order: Order) => (
              <div key={order.id} className="bg-sheen-white rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-body text-xs text-sheen-muted">
                    {format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-body font-medium ${statusColor[order.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {t(order.status as any)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(order.order_items ?? []).map((item: OrderItem, idx: number) => (
                    <span key={idx} className="bg-sheen-cream text-sheen-black text-xs font-body px-2 py-1 rounded-md">
                      {item.name} x{item.qty}
                    </span>
                  ))}
                </div>
                <p className="font-body text-sm font-semibold text-sheen-brown">{order.total_amount.toFixed(2)} AED</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
