import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrders, updateOrderStatus } from '../services/orderService'
import TopBar from '../components/layout/TopBar'
import { useLanguage } from '../i18n/LanguageContext'
import { playNotificationSound } from '../components/OrderNotifier'
import StickerPrint from '../components/StickerPrint'
import toast from 'react-hot-toast'
import type { Order, OrderItem } from '../types'
import { format } from 'date-fns'
import { printReceipt } from '../utils/printReceipt'

const STATUS_TABS = ['pending', 'rejected', 'completed'] as const

export default function Orders() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<string>('pending')
  const [stickerOrder, setStickerOrder] = useState<Order | null>(null)

  // Pending tab shows both 'pending' and 'confirmed' orders
  const fetchStatus = activeTab === 'pending' ? undefined : activeTab === 'all' ? undefined : activeTab
  const { data: rawOrders = [], isLoading } = useQuery({
    queryKey: ['orders', activeTab],
    queryFn: () => getOrders(fetchStatus ? { status: fetchStatus } : undefined),
    refetchInterval: 10000,
  })
  const orders = activeTab === 'pending'
    ? rawOrders.filter((o: Order) => o.status === 'pending' || o.status === 'confirmed')
    : rawOrders

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateOrderStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast.success(t('orderUpdated'))
    },
    onError: () => toast.error('Failed to update order'),
  })

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    completed: 'bg-blue-100 text-blue-700',
  }

  const pendingCount = orders.filter((o: Order) => o.status === 'pending').length

  const handlePrintReceipt = (order: Order) => {
    const items = (order.order_items ?? []).map((i: OrderItem) => ({ name: i.name, qty: i.qty, total: i.total }))
    printReceipt({
      orderNumber: order.id.slice(0, 8).toUpperCase(),
      date: new Date(order.created_at),
      customerName: (order.customer_name ?? '').replace('Staff: ', '').replace('POS: ', '') || undefined,
      source: order.notes?.match(/\[(\w+)/)?.[1] || undefined,
      items,
      subtotal: order.total_amount,
      total: order.total_amount,
    })
  }

  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title={t('orders')} />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-3xl text-sheen-black">{t('orders')}</h1>
          <div className="flex items-center gap-3">
            {pendingCount > 0 && activeTab !== 'pending' && (
              <span className="bg-yellow-500 text-white text-xs font-bold px-2.5 py-1 rounded-full animate-pulse">
                {pendingCount} {t('pending')}
              </span>
            )}
            <button
              onClick={() => playNotificationSound()}
              title={t('testSound')}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-sheen-gold/15 text-sheen-gold transition-colors hover:bg-sheen-gold/25"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            </button>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none no-scrollbar" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setActiveTab('all')}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-body font-medium transition-colors ${
              activeTab === 'all' ? 'bg-sheen-black text-white' : 'bg-sheen-white text-sheen-muted border border-sheen-muted/30'
            }`}
          >
            {t('all')}
          </button>
          {STATUS_TABS.map((s) => (
            <button
              key={s}
              onClick={() => setActiveTab(s)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-body font-medium transition-colors ${
                activeTab === s ? 'bg-sheen-black text-white' : 'bg-sheen-white text-sheen-muted border border-sheen-muted/30'
              }`}
            >
              {t(s as any)}
            </button>
          ))}
        </div>

        {/* Orders List */}
        {isLoading ? (
          <p className="text-center text-sheen-muted font-body py-12">{t('loading')}</p>
        ) : orders.length === 0 ? (
          <p className="text-center text-sheen-muted font-body py-12">{t('noOrders')}</p>
        ) : (
          <div className="space-y-4">
            {orders.map((order: Order) => (
              <div key={order.id} className="bg-sheen-white rounded-xl shadow-sm p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-body font-medium text-sheen-black inline-flex items-center gap-2">
                      {(order.customer_name ?? '').startsWith('Staff:')
                        ? (order.customer_name ?? '').replace('Staff: ', '')
                        : order.customer_name || order.customer_email?.split('@')[0] || 'Customer'}
                      {order.notes?.startsWith('[POS') && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-body font-medium bg-sheen-muted/15 text-sheen-muted">POS</span>
                      )}
                    </p>
                    {order.customer_email && order.customer_name && (
                      <p className="font-body text-xs text-sheen-muted">{order.customer_email}</p>
                    )}
                    <p className="font-body text-xs text-sheen-muted">
                      {format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-body font-medium ${statusColor[order.status]}`}>
                    {t(order.status as any)}
                  </span>
                </div>

                {/* Items */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {(order.order_items ?? []).map((item: OrderItem, idx: number) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 bg-sheen-cream text-sm font-body px-3 py-1.5 rounded-lg">
                      <span className="text-sheen-black">{item.name}</span>
                      <span className="text-sheen-muted">×</span>
                      <span className="text-sheen-black font-medium">{item.qty}</span>
                      <span className="text-sheen-brown font-semibold">{item.total.toFixed(2)}</span>
                    </span>
                  ))}
                </div>

                {/* Delivery / Pickup badge */}
                {(() => {
                  const deliveryMatch = order.notes?.match(/\[Delivery\](?: → (.+))?/)
                  const isPickup = order.notes?.includes('[Pickup]')
                  if (deliveryMatch) {
                    const address = deliveryMatch[1]?.split('\n')[0]?.trim()
                    return (
                      <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg bg-orange-50 border border-orange-200">
                        <span className="text-base mt-0.5">🛵</span>
                        <div>
                          <span className="font-body text-sm font-bold text-orange-700 uppercase tracking-wide">Delivery</span>
                          {address && <p className="font-body text-xs text-orange-600 mt-0.5">{address}</p>}
                        </div>
                      </div>
                    )
                  }
                  if (isPickup) {
                    return (
                      <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                        <span className="text-base">🏪</span>
                        <span className="font-body text-sm font-semibold text-blue-700">Pickup</span>
                      </div>
                    )
                  }
                  return null
                })()}

                {/* Notes — hide internal tags */}
                {order.notes && !order.notes.startsWith('[POS') && !order.notes.startsWith('[Payment') && (() => {
                  const cleaned = order.notes
                    .split('\n')
                    .filter(l => !l.startsWith('[Delivery]') && !l.startsWith('[Pickup]') && !l.startsWith('[Payment') && !l.startsWith('[POS'))
                    .join('\n')
                    .trim()
                  return cleaned ? <p className="font-body text-xs text-sheen-muted italic mb-3">"{cleaned}"</p> : null
                })()}

                {/* Total + Actions */}
                <div className="flex items-center justify-between border-t border-sheen-cream pt-3">
                  <p className="font-display text-lg font-bold text-sheen-brown">{order.total_amount.toFixed(2)} AED</p>
                  <div className="flex gap-2">
                    {/* New order — Confirm or Reject */}
                    {order.status === 'pending' && (
                      <>
                        <button
                          onClick={() => {
                            updateStatus.mutate({ id: order.id, status: 'confirmed' }, {
                              onSuccess: () => setStickerOrder(order),
                            })
                          }}
                          disabled={updateStatus.isPending}
                          className="px-4 py-1.5 rounded-lg bg-green-500 text-white text-sm font-body font-medium hover:bg-green-600 transition-colors disabled:opacity-50"
                        >
                          {t('confirm')}
                        </button>
                        <button
                          onClick={() => updateStatus.mutate({ id: order.id, status: 'rejected' })}
                          disabled={updateStatus.isPending}
                          className="px-4 py-1.5 rounded-lg bg-red-500 text-white text-sm font-body font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          {t('reject')}
                        </button>
                      </>
                    )}
                    {/* Confirmed — Complete or Print Sticker */}
                    {order.status === 'confirmed' && (
                      <>
                        <button
                          onClick={() => updateStatus.mutate({ id: order.id, status: 'completed' })}
                          disabled={updateStatus.isPending}
                          className="px-4 py-1.5 rounded-lg bg-blue-500 text-white text-sm font-body font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
                        >
                          {t('markComplete')}
                        </button>
                        <button
                          onClick={() => setStickerOrder(order)}
                          className="px-4 py-1.5 rounded-lg bg-sheen-gold/20 text-sheen-brown text-sm font-body font-medium hover:bg-sheen-gold/30 transition-colors"
                        >
                          {t('printSticker')}
                        </button>
                      </>
                    )}
                    {/* Completed — Print Sticker only */}
                    {order.status === 'completed' && (
                      <button
                        onClick={() => setStickerOrder(order)}
                        className="px-4 py-1.5 rounded-lg bg-sheen-gold/20 text-sheen-brown text-sm font-body font-medium hover:bg-sheen-gold/30 transition-colors"
                      >
                        {t('printSticker')}
                      </button>
                    )}
                    {/* Print Receipt — always available */}
                    <button
                      onClick={() => handlePrintReceipt(order)}
                      className="px-4 py-1.5 rounded-lg bg-sheen-cream text-sheen-black text-sm font-body font-medium hover:bg-sheen-muted/20 transition-colors"
                    >
                      {t('printReceipt')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {stickerOrder && (
        <StickerPrint
          customerName={stickerOrder.customer_name || stickerOrder.customer_email?.split('@')[0] || undefined}
          onClose={() => setStickerOrder(null)}
        />
      )}
    </div>
  )
}
