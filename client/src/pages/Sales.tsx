import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTodaySales, useRecordSale, useDeleteSale } from '../hooks/useSales'
import { useMenuItems } from '../hooks/useFixedCosts'
import type { MenuCategory, SalePayload, MenuItem, Sale, SaleItem } from '../types'
import TopBar from '../components/layout/TopBar'
import Button from '../components/ui/Button'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useLanguage } from '../i18n/LanguageContext'

const CATEGORIES: MenuCategory[] = [
  'Coffee',
  'Matcha',
  'Cold Drinks',
  'Açaí',
  'Desserts',
  'Bites',
]

export default function Sales() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const { data: menuItems = [], isLoading: menuLoading } = useMenuItems()
  const { data: todaySales = [], isLoading: salesLoading } = useTodaySales()
  const recordSale = useRecordSale()
  const deleteSale = useDeleteSale()

  const [activeCategory, setActiveCategory] = useState<MenuCategory>('Coffee')
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  // Realtime subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel('sales-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sale_items' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['sales'] })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  // Group menu items by category
  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, MenuItem[]> = {}
    for (const cat of CATEGORIES) {
      grouped[cat] = menuItems.filter((item: MenuItem) => item.category === cat)
    }
    return grouped
  }, [menuItems])

  const currentItems = itemsByCategory[activeCategory] ?? []

  // Quantity helpers
  const getQty = useCallback(
    (itemId: string) => quantities[itemId] ?? 0,
    [quantities],
  )

  const setQty = useCallback((itemId: string, value: number) => {
    const clamped = Math.max(0, Math.floor(value))
    setQuantities((prev) => {
      if (clamped === 0) {
        const next = { ...prev }
        delete next[itemId]
        return next
      }
      return { ...prev, [itemId]: clamped }
    })
  }, [])

  const increment = useCallback(
    (itemId: string) =>
      setQuantities((prev) => ({ ...prev, [itemId]: (prev[itemId] ?? 0) + 1 })),
    [],
  )

  const decrement = useCallback(
    (itemId: string) =>
      setQuantities((prev) => {
        const current = prev[itemId] ?? 0
        if (current <= 1) {
          const next = { ...prev }
          delete next[itemId]
          return next
        }
        return { ...prev, [itemId]: current - 1 }
      }),
    [],
  )

  // Live subtotal calculation
  const subtotal = useMemo(() => {
    let total = 0
    for (const [id, qty] of Object.entries(quantities)) {
      const item = menuItems.find((m: MenuItem) => m.id === id)
      if (item) total += item.selling_price * qty
    }
    return total
  }, [quantities, menuItems])

  const hasItems = Object.values(quantities).some((q) => q > 0)

  // Record sale handler
  const handleRecordSale = () => {
    if (!hasItems) return

    const today = new Date().toISOString().split('T')[0]
    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const menuItem = menuItems.find((m: MenuItem) => m.id === id)
        return {
          menu_item_id: id,
          name: menuItem?.name ?? '',
          category: menuItem?.category ?? '',
          price: menuItem?.selling_price ?? 0,
          qty,
          total: (menuItem?.selling_price ?? 0) * qty,
        }
      })

    const payload: SalePayload = { sale_date: today, items }

    recordSale.mutate(payload, {
      onSuccess: () => {
        setQuantities({})
      },
    })
  }

  // Daily totals
  const dailyTotals = useMemo(() => {
    let cups = 0
    let revenue = 0
    for (const sale of todaySales) {
      cups += sale.total_cups
      revenue += sale.total_revenue
    }
    return { cups, revenue }
  }, [todaySales])

  // Sorted sales (reverse chronological)
  const sortedSales = useMemo(
    () =>
      [...todaySales].sort(
        (a: Sale, b: Sale) =>
          new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
      ),
    [todaySales],
  )

  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title={t('sales')} />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="font-display text-3xl text-sheen-black mb-6">
          {t('recordSales')}
        </h1>

        {/* ── Category Tabs ── */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none no-scrollbar" style={{ scrollbarWidth: 'none' }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-body font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-sheen-brown text-sheen-white'
                  : 'bg-sheen-white text-sheen-black border border-sheen-muted hover:bg-sheen-gold/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Menu Items Grid ── */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-6 mb-8">
          {menuLoading ? (
            <p className="text-sheen-muted font-body">{t('loadingMenu')}</p>
          ) : currentItems.length === 0 ? (
            <p className="text-sheen-muted font-body">
              {t('noItemsInCategory')}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentItems.map((item: MenuItem) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border border-sheen-muted/30 rounded-lg p-3"
                >
                  <div className="min-w-0 mr-3">
                    <p className="font-body font-medium text-sheen-black truncate">
                      {item.name}
                    </p>
                    <p className="font-body text-sm text-sheen-brown">
                      {item.selling_price} د.إ
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => decrement(item.id)}
                      disabled={getQty(item.id) === 0}
                      className="w-10 h-10 flex items-center justify-center rounded-md bg-sheen-cream text-sheen-black font-bold hover:bg-sheen-gold/20 active:bg-sheen-gold/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      &minus;
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={getQty(item.id)}
                      onChange={(e) =>
                        setQty(item.id, parseInt(e.target.value, 10) || 0)
                      }
                      className="w-12 h-10 text-center font-body text-sm border border-sheen-muted/40 rounded-md bg-sheen-cream focus:outline-none focus:ring-1 focus:ring-sheen-gold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => increment(item.id)}
                      className="w-10 h-10 flex items-center justify-center rounded-md bg-sheen-cream text-sheen-black font-bold hover:bg-sheen-gold/20 active:bg-sheen-gold/30 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Subtotal bar + Record button */}
          <div className="mt-6 flex items-center justify-between border-t border-sheen-muted/20 pt-4">
            <p className="font-body text-lg text-sheen-black">
              {t('subtotal')}:{' '}
              <span className="font-display font-semibold text-sheen-brown">
                {subtotal.toFixed(2)} د.إ
              </span>
            </p>
            <Button
              onClick={handleRecordSale}
              disabled={!hasItems || recordSale.isPending}
            >
              {recordSale.isPending ? t('recording') : t('recordSale')}
            </Button>
          </div>
        </div>

        {/* ── Daily Summary Cards ── */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-sheen-white rounded-xl shadow-sm p-5 text-center">
            <p className="font-body text-sm text-sheen-muted mb-1">
              {t('todaysCups')}
            </p>
            <p className="font-display text-2xl text-sheen-brown">
              {dailyTotals.cups}
            </p>
          </div>
          <div className="bg-sheen-white rounded-xl shadow-sm p-5 text-center">
            <p className="font-body text-sm text-sheen-muted mb-1">
              {t('todaysRevenue')}
            </p>
            <p className="font-display text-2xl text-sheen-brown">
              {dailyTotals.revenue.toFixed(2)} د.إ
            </p>
          </div>
        </div>

        {/* ── Today's Sales Log ── */}
        <h2 className="font-display text-2xl text-sheen-black mb-4">
          {t('todaysSalesLog')}
        </h2>

        <div className="bg-sheen-white rounded-xl shadow-sm divide-y divide-sheen-muted/20">
          {salesLoading ? (
            <p className="p-6 font-body text-sheen-muted">{t('loadingSales')}</p>
          ) : sortedSales.length === 0 ? (
            <p className="p-6 font-body text-sheen-muted">
              {t('noSalesRecordedToday')}
            </p>
          ) : (
            sortedSales.map((sale: Sale & { sale_items?: SaleItem[] }) => {
              const saleItems = sale.sale_items ?? []

              return (
                <div
                  key={sale.id}
                  className="p-4 flex items-start justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-xs text-sheen-muted mb-1">
                      {format(new Date(sale.recorded_at), 'hh:mm a')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {saleItems.map((si: SaleItem, idx: number) => (
                        <span
                          key={idx}
                          className="inline-block bg-sheen-cream text-sheen-black text-xs font-body px-2 py-1 rounded-md"
                        >
                          {si.name} x{si.qty}
                        </span>
                      ))}
                    </div>
                    <p className="font-body text-sm text-sheen-brown mt-1">
                      {sale.total_revenue.toFixed(2)} د.إ
                    </p>
                  </div>

                  <button
                    onClick={() => deleteSale.mutate(sale.id)}
                    disabled={deleteSale.isPending}
                    className="shrink-0 text-red-500 hover:text-red-700 text-sm font-body transition-colors disabled:opacity-50"
                  >
                    {t('delete')}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </main>
    </div>
  )
}
