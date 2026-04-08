import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTodaySales, useRecordSale, useDeleteSale } from '../hooks/useSales'
import { useMenuItems } from '../hooks/useFixedCosts'
import type { MenuCategory, SalePayload, MenuItem, Sale, SaleItem } from '../types'
import TopBar from '../components/layout/TopBar'
import Button from '../components/ui/Button'
import { supabase } from '../lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { format } from 'date-fns'
import { useLanguage } from '../i18n/LanguageContext'
import { getItemImage } from '../data/itemImages'
import { generateDailyReport } from '../utils/dailyReport'

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
  const [orderSource, setOrderSource] = useState('POS')

  // Fetch commission rates from database
  const DEFAULT_SOURCES = [
    { id: 'POS', commission: 0, vat: false },
    { id: 'Talabat', commission: 15, vat: false },
    { id: 'Beanz', commission: 2.5, vat: true },
    { id: 'App', commission: 0, vat: false },
    { id: 'Other', commission: 0, vat: false },
  ]

  const { data: orderSources } = useQuery({
    queryKey: ['settings', 'order_sources'],
    queryFn: async () => {
      const { data } = await api.get('/api/settings/order_sources')
      return data as { id: string; commission: number; vat?: boolean }[] | null
    },
    staleTime: 60_000,
  })

  const ORDER_SOURCES = orderSources ?? DEFAULT_SOURCES
  const currentSource = ORDER_SOURCES.find((s: { id: string }) => s.id === orderSource) ?? ORDER_SOURCES[0]

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
      grouped[cat] = menuItems.filter((item: MenuItem) => item.category === cat && item.is_active)
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

  const commissionBase = subtotal * (currentSource.commission / 100)
  const vatOnCommission = (currentSource as any).vat ? commissionBase * 0.05 : 0
  const commissionAmount = commissionBase + vatOnCommission
  const netRevenue = subtotal - commissionAmount

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

    const payload: SalePayload = { sale_date: today, items, recorded_by: orderSource }

    recordSale.mutate(payload, {
      onSuccess: () => {
        setQuantities({})
        setOrderSource('POS')
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

  // ── Swipe-to-change-category logic ──
  const tabsRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const isSwiping = useRef(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isSwiping.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current)
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current)
    if (deltaX > deltaY && deltaX > 10) {
      isSwiping.current = true
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isSwiping.current) return
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    const threshold = 50
    if (Math.abs(deltaX) < threshold) return

    const currentIndex = CATEGORIES.indexOf(activeCategory)
    if (deltaX < 0 && currentIndex < CATEGORIES.length - 1) {
      // Swipe left → next category
      setActiveCategory(CATEGORIES[currentIndex + 1])
    } else if (deltaX > 0 && currentIndex > 0) {
      // Swipe right → previous category
      setActiveCategory(CATEGORIES[currentIndex - 1])
    }
  }

  // Auto-scroll active tab into view
  useEffect(() => {
    if (!tabsRef.current) return
    const activeBtn = tabsRef.current.querySelector('[data-active="true"]') as HTMLElement | null
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [activeCategory])

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

        {/* ── Category Tabs (swipeable) ── */}
        <div
          ref={tabsRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none no-scrollbar snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              data-active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-body font-medium transition-colors snap-start ${
                activeCategory === cat
                  ? 'bg-sheen-brown text-sheen-white shadow-md'
                  : 'bg-sheen-white text-sheen-black border border-sheen-muted hover:bg-sheen-gold/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Menu Items Grid (swipeable) ── */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="bg-sheen-white rounded-xl shadow-sm p-6 mb-8"
        >
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
                  <div className="flex items-center gap-2 min-w-0 mr-3">
                    {getItemImage(item.name, item.image_url) ? (
                      <img
                        src={getItemImage(item.name, item.image_url)}
                        alt={item.name}
                        className="w-12 h-12 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-sheen-cream flex items-center justify-center shrink-0 text-xl">
                        ☕
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-body font-medium text-sheen-black text-sm leading-tight">
                        {item.name}
                      </p>
                      <p className="font-body text-sm text-sheen-brown">
                        {item.selling_price} د.إ
                      </p>
                    </div>
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

          {/* Order source + Subtotal + Record button */}
          <div className="mt-6 border-t border-sheen-muted/20 pt-4 space-y-3">
            {/* Order Source */}
            <div>
              <p className="font-body text-xs text-sheen-muted mb-1.5">{t('orderSource')}</p>
              <div className="flex gap-1.5 flex-wrap">
                {ORDER_SOURCES.map((src) => (
                  <button
                    key={src.id}
                    onClick={() => setOrderSource(src.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-body font-medium transition-colors ${
                      orderSource === src.id
                        ? 'bg-sheen-brown text-white'
                        : 'bg-sheen-cream text-sheen-muted border border-sheen-muted/20'
                    }`}
                  >
                    {src.id}{src.commission > 0 ? ` (${src.commission}%)` : ''}
                  </button>
                ))}
              </div>
            </div>
            {/* Subtotal + Commission + VAT + Record */}
            <div>
              <div className="flex items-center justify-between">
                <p className="font-body text-sm text-sheen-black">
                  {t('subtotal')}: <span className="font-semibold">{subtotal.toFixed(2)} د.إ</span>
                </p>
              </div>
              {currentSource.commission > 0 && (
                <div className="space-y-0.5 mt-1">
                  <div className="flex items-center justify-between">
                    <p className="font-body text-xs text-red-500">
                      {t('commission')} ({currentSource.commission}%)
                    </p>
                    <p className="font-body text-xs text-red-500">-{commissionBase.toFixed(2)} د.إ</p>
                  </div>
                  {vatOnCommission > 0 && (
                    <div className="flex items-center justify-between">
                      <p className="font-body text-xs text-red-400">VAT 5% {t('onCommission')}</p>
                      <p className="font-body text-xs text-red-400">-{vatOnCommission.toFixed(2)} د.إ</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-sheen-muted/20 pt-1 mt-1">
                    <p className="font-body text-lg text-sheen-black">
                      {t('netRevenue')}:
                    </p>
                    <p className="font-display text-lg font-semibold text-sheen-brown">{netRevenue.toFixed(2)} د.إ</p>
                  </div>
                </div>
              )}
              {currentSource.commission === 0 && (
                <p className="font-body text-lg text-sheen-black mt-1">
                  {t('total')}: <span className="font-display font-semibold text-sheen-brown">{subtotal.toFixed(2)} د.إ</span>
                </p>
              )}
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleRecordSale}
                disabled={!hasItems || recordSale.isPending}
              >
                {recordSale.isPending ? t('recording') : t('recordSale')}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Daily Summary + PDF Report ── */}
        <div className="flex justify-end mb-2">
          <button
            onClick={() => generateDailyReport(todaySales, ORDER_SOURCES as any)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sheen-black text-sheen-gold font-body text-sm font-medium hover:bg-sheen-black/90 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            {t('downloadReport')}
          </button>
        </div>
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
                    <p className="font-body text-xs text-sheen-muted mb-1 flex items-center gap-2">
                      {format(new Date(sale.recorded_at), 'hh:mm a')}
                      {sale.recorded_by && (
                        <span className="px-1.5 py-0.5 rounded bg-sheen-cream text-sheen-brown text-[10px] font-medium">{sale.recorded_by}</span>
                      )}
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
