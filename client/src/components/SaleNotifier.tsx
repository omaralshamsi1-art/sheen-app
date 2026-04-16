import { useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { useRole } from '../hooks/useRole'

/**
 * Polls today's sales every 15s. When a new sale appears that wasn't
 * in the previous poll, sends a browser Notification to the admin.
 * Only active when admin_sale_notifications is enabled in Settings.
 */
export default function SaleNotifier() {
  const { isAdmin } = useRole()

  const { data: enabled = false } = useQuery({
    queryKey: ['settings', 'admin_sale_notifications'],
    queryFn: async () => {
      const { data } = await api.get('/api/settings/admin_sale_notifications')
      return data === true
    },
    staleTime: 60_000,
  })

  const { data: sales = [] } = useQuery({
    queryKey: ['sale-notifier-poll'],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await api.get(`/api/sales?from=${today}&to=${today}`)
      return data as Array<{
        id: string
        total_revenue: number
        total_cups: number
        recorded_by?: string
        recorded_at: string
        sale_items?: Array<{ name: string; qty: number }>
      }>
    },
    refetchInterval: isAdmin && enabled ? 15000 : false,
    enabled: isAdmin && enabled,
  })

  const prevIdsRef = useRef<Set<string>>(new Set())
  const initialRef = useRef(true)

  useEffect(() => {
    if (!isAdmin || !enabled) return

    const currentIds = new Set(sales.map(s => s.id))

    if (initialRef.current) {
      prevIdsRef.current = currentIds
      initialRef.current = false
      return
    }

    for (const sale of sales) {
      if (!prevIdsRef.current.has(sale.id)) {
        // New sale detected — send browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            // Format time in UAE (UTC+4)
            const d = new Date(sale.recorded_at)
            const uaeHours = (d.getUTCHours() + 4) % 24
            const timeStr = `${String(uaeHours).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`

            // Items list: "Americano ×2, Latte ×1"
            const itemsStr = (sale.sale_items ?? [])
              .map(it => `${it.name} ×${it.qty}`)
              .join(', ')

            const bodyParts = [
              itemsStr || `${sale.total_cups} cup${sale.total_cups !== 1 ? 's' : ''}`,
              `${Number(sale.total_revenue).toFixed(2)} AED`,
              `⏰ ${timeStr}${sale.recorded_by ? ` · ${sale.recorded_by}` : ''}`,
            ]

            new Notification('New Sale Recorded', {
              body: bodyParts.join('\n'),
              icon: '/images/logo.png',
              tag: `sale-${sale.id}`,
            })
          } catch {
            // Notification constructor might fail in some contexts
          }
        }
      }
    }

    prevIdsRef.current = currentIds
  }, [sales, isAdmin, enabled])

  return null // invisible component
}
