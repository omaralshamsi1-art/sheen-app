import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrders, updateOrderStatus } from '../services/orderService'
import TopBar from '../components/layout/TopBar'
import { useLanguage } from '../i18n/LanguageContext'
import toast from 'react-hot-toast'
import type { Order, OrderItem, OrderStatus } from '../types'
import { format } from 'date-fns'

const STATUS_TABS: OrderStatus[] = ['pending', 'confirmed', 'rejected', 'completed']

// Shared AudioContext — unlocked on first user interaction
let sharedAudioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioContext()
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume()
  }
  return sharedAudioCtx
}

// Unlock audio on any user interaction (required by browsers)
function unlockAudio() {
  try { getAudioCtx() } catch { /* ignore */ }
}
if (typeof window !== 'undefined') {
  window.addEventListener('click', unlockAudio, { once: true })
  window.addEventListener('touchstart', unlockAudio, { once: true })
}

// Generate a notification chime using Web Audio API
function playNotificationSound() {
  try {
    const ctx = getAudioCtx()
    const now = ctx.currentTime

    // First tone
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(880, now)
    gain1.gain.setValueAtTime(0.4, now)
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
    osc1.connect(gain1).connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.3)

    // Second tone (delayed)
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1175, now + 0.15)
    gain2.gain.setValueAtTime(0, now)
    gain2.gain.setValueAtTime(0.4, now + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5)
    osc2.connect(gain2).connect(ctx.destination)
    osc2.start(now + 0.15)
    osc2.stop(now + 0.5)

    // Third tone (highest)
    const osc3 = ctx.createOscillator()
    const gain3 = ctx.createGain()
    osc3.type = 'sine'
    osc3.frequency.setValueAtTime(1318, now + 0.3)
    gain3.gain.setValueAtTime(0, now)
    gain3.gain.setValueAtTime(0.35, now + 0.3)
    gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.7)
    osc3.connect(gain3).connect(ctx.destination)
    osc3.start(now + 0.3)
    osc3.stop(now + 0.7)
  } catch {
    // Audio not available — silent fallback
  }
}

export default function Orders() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<OrderStatus | 'all'>('pending')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const prevPendingIdsRef = useRef<Set<string>>(new Set())
  const initialLoadRef = useRef(true)

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', activeTab],
    queryFn: () => getOrders(activeTab !== 'all' ? { status: activeTab } : undefined),
    refetchInterval: 10000, // Poll every 10s for new orders
  })

  // Also poll all pending orders for sound detection
  const { data: allPending = [] } = useQuery({
    queryKey: ['orders', 'pending-sound'],
    queryFn: () => getOrders({ status: 'pending' }),
    refetchInterval: 10000,
  })

  // Detect new pending orders and play sound
  useEffect(() => {
    const currentIds = new Set(allPending.map((o: Order) => o.id))

    if (initialLoadRef.current) {
      // First load — just record current IDs, don't alert
      prevPendingIdsRef.current = currentIds
      initialLoadRef.current = false
      return
    }

    if (!soundEnabled) {
      prevPendingIdsRef.current = currentIds
      return
    }

    // Check if any order IDs are new (not seen before)
    let hasNew = false
    for (const id of currentIds) {
      if (!prevPendingIdsRef.current.has(id)) {
        hasNew = true
        break
      }
    }

    if (hasNew) {
      playNotificationSound()
      toast(t('newOrderReceived'), { icon: '\u{1F514}', duration: 4000 })
    }

    prevPendingIdsRef.current = currentIds
  }, [allPending, soundEnabled, t])

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
              onClick={() => {
                setSoundEnabled(!soundEnabled)
                if (!soundEnabled) playNotificationSound()
              }}
              title={soundEnabled ? t('soundOn') : t('soundOff')}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
                soundEnabled
                  ? 'bg-sheen-gold/15 text-sheen-gold'
                  : 'bg-sheen-muted/10 text-sheen-muted'
              }`}
            >
              {soundEnabled ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              )}
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
                    <p className="font-body font-medium text-sheen-black">
                      {order.customer_name || order.customer_email || 'Customer'}
                    </p>
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
                    <span key={idx} className="bg-sheen-cream text-sheen-black text-sm font-body px-3 py-1.5 rounded-lg">
                      {item.name} <span className="text-sheen-muted">x{item.qty}</span> <span className="text-sheen-brown font-medium">{item.total.toFixed(2)}</span>
                    </span>
                  ))}
                </div>

                {/* Notes */}
                {order.notes && (
                  <p className="font-body text-xs text-sheen-muted italic mb-3">"{order.notes}"</p>
                )}

                {/* Total + Actions */}
                <div className="flex items-center justify-between border-t border-sheen-cream pt-3">
                  <p className="font-display text-lg font-bold text-sheen-brown">{order.total_amount.toFixed(2)} AED</p>
                  <div className="flex gap-2">
                    {order.status === 'pending' && (
                      <>
                        <button
                          onClick={() => updateStatus.mutate({ id: order.id, status: 'confirmed' })}
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
                    {order.status === 'confirmed' && (
                      <button
                        onClick={() => updateStatus.mutate({ id: order.id, status: 'completed' })}
                        disabled={updateStatus.isPending}
                        className="px-4 py-1.5 rounded-lg bg-blue-500 text-white text-sm font-body font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
                      >
                        {t('markComplete')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
