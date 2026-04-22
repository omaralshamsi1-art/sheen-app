import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '../i18n/LanguageContext'
import { useHourlySales, useTopSellers } from '../hooks/useSales'
import { salesService } from '../services/salesService'
import { useFixedCosts } from '../hooks/useFixedCosts'
import { useAutoInsight } from '../hooks/useAI'
import TopBar from '../components/layout/TopBar'
import StatCard from '../components/cards/StatCard'
import InsightCard from '../components/cards/InsightCard'
import RevenueChart from '../components/charts/RevenueChart'
import HourlyChart from '../components/charts/HourlyChart'
import type { FixedCost, TopSeller, Sale, SaleItem } from '../types'
import { format, addDays, isBefore, parseISO } from 'date-fns'
import api from '../lib/api'

/* ------------------------------------------------------------------ */
/*  Skeleton placeholder                                               */
/* ------------------------------------------------------------------ */

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-sheen-muted/20 ${className}`} />
  )
}

function KPISkeleton() {
  return (
    <div className="bg-sheen-white rounded-xl shadow-sm p-5 space-y-3">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Dashboard                                                          */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const { t } = useLanguage()
  const todayStr = new Date().toISOString().split('T')[0]
  // Single-day mode when range is null; otherwise range.
  const [range, setRange] = useState<{ from: string; to: string } | null>(null)
  const [selectedDate, setSelectedDate] = useState(todayStr)

  const kpiKey = range ? `${range.from}_${range.to}` : selectedDate
  const dateArg = range ?? selectedDate
  const [sourceDetail, setSourceDetail] = useState<string | null>(null)

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['dashboard', 'kpis', kpiKey],
    queryFn: () => salesService.getDashboardKPIs(dateArg),
    staleTime: 30_000,
  })
  const { data: hourlySales, isLoading: hourlyLoading } = useHourlySales(dateArg)
  const { data: topSellers, isLoading: sellersLoading } = useTopSellers(dateArg, 5)
  const { data: salesBySource = [] } = useQuery({
    queryKey: ['dashboard', 'by-source', kpiKey],
    queryFn: () => salesService.getSalesBySource(dateArg),
    staleTime: 30_000,
  })
  const [chartPeriod, setChartPeriod] = useState<7 | 14 | 30>(7)
  const chartKey = range ? `range_${range.from}_${range.to}` : `days_${chartPeriod}`
  const { data: chartData, isLoading: revenueLoading } = useQuery({
    queryKey: ['dashboard', 'revenue-chart', chartKey],
    queryFn: () =>
      range
        ? salesService.getRevenueByRange(range.from, range.to)
        : salesService.getRevenueByDays(chartPeriod),
    staleTime: 30_000,
  })
  const { data: fixedCosts, isLoading: costsLoading } = useFixedCosts()
  const { insight, isLoading: insightLoading, fetchInsight: refreshInsight } = useAutoInsight()

  /* ---- Derived values ---- */

  const totalRevenue = kpis?.total_revenue ?? 0
  const cupsSold = kpis?.total_cups ?? 0
  const totalExpenses = kpis?.total_expenses ?? 0
  const pettyCashSpent = (kpis as any)?.petty_cash_spent ?? 0

  // Net Profit = Revenue - Expenses - Petty Cash - (Fixed Costs / 30)
  const monthlyFixedTotal =
    fixedCosts?.reduce(
      (sum: number, fc: { amount: number }) => sum + (fc.amount ?? 0),
      0,
    ) ?? 0
  const dailyFixedCost = monthlyFixedTotal / 30
  const netProfit = totalRevenue - totalExpenses - pettyCashSpent - dailyFixedCost

  // Upcoming unpaid fixed costs (due within 7 days)
  const today = new Date()
  const sevenDaysOut = addDays(today, 7)

  const upcomingAlerts = (fixedCosts ?? []).filter(
    (fc: FixedCost) =>
      !fc.is_paid &&
      fc.due_date &&
      isBefore(parseISO(fc.due_date), sevenDaysOut),
  )

  /* ---- KPI card config ---- */

  const kpiCards = [
    {
      title: t('totalRevenueToday'),
      value: `${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.إ`,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M16 8H13C11.9 8 11 8.9 11 10C11 11.1 11.9 12 13 12H15C16.1 12 17 12.9 17 14C17 15.1 16.1 16 15 16H8" />
          <path d="M12 6V8" /><path d="M12 16V18" />
        </svg>
      ),
    },
    {
      title: t('cupsSoldToday'),
      value: cupsSold.toLocaleString(),
      icon: (
        <img src="/images/Cafe-Outline--Streamline-Ionic-Outline.svg" alt="" width={22} height={22} style={{ filter: 'brightness(0) saturate(100%) invert(67%) sepia(30%) saturate(600%) hue-rotate(5deg)' }} />
      ),
    },
    {
      title: t('totalExpensesToday'),
      value: `${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.إ`,
      icon: (
        <img src="/images/Receipt-Outline--Streamline-Ionic-Outline.svg" alt="" width={22} height={22} style={{ filter: 'brightness(0) saturate(100%) invert(67%) sepia(30%) saturate(600%) hue-rotate(5deg)' }} />
      ),
    },
    {
      title: 'Petty Cash Spent',
      value: `${pettyCashSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.إ`,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M2 10H22" />
          <path d="M6 14H10" />
        </svg>
      ),
    },
    {
      title: t('netProfitToday'),
      value: `${netProfit >= 0 ? '' : '-'}${Math.abs(netProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.إ`,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 21H4C3.45 21 3 20.55 3 20V3" />
          <path d="M7 17L12 11L16 14L21 8" />
          <path d="M18 8H21V11" />
        </svg>
      ),
    },
  ]

  /* ---- Render ---- */

  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title={t('dashboard')} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ---------- Date / Range Picker ---------- */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-4 space-y-3">
          {/* Preset buttons */}
          <div className="flex flex-wrap gap-2">
            {(() => {
              const daysAgo = (n: number) => {
                const d = new Date(); d.setDate(d.getDate() - n + 1)
                return d.toISOString().slice(0, 10)
              }
              const presets: Array<[string, () => void]> = [
                ['Today', () => { setRange(null); setSelectedDate(todayStr) }],
                ['7 Days', () => setRange({ from: daysAgo(7), to: todayStr })],
                ['30 Days', () => setRange({ from: daysAgo(30), to: todayStr })],
                ['3 Months', () => setRange({ from: daysAgo(90), to: todayStr })],
                ['6 Months', () => setRange({ from: daysAgo(180), to: todayStr })],
                ['1 Year', () => setRange({ from: daysAgo(365), to: todayStr })],
                ['All Time', () => setRange({ from: '2020-01-01', to: todayStr })],
              ]
              return presets.map(([label, on]) => (
                <button
                  key={label}
                  onClick={on}
                  className="px-3 py-1.5 rounded-full text-xs font-body font-medium bg-sheen-cream text-sheen-muted hover:bg-sheen-gold/10 hover:text-sheen-brown transition-colors"
                >
                  {label}
                </button>
              ))
            })()}
          </div>

          {/* Manual from-to inputs */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-body text-xs text-sheen-muted">From</span>
            <input
              type="date"
              value={range ? range.from : selectedDate}
              max={todayStr}
              onChange={(e) => {
                const v = e.target.value
                if (range) setRange({ ...range, from: v })
                else setRange({ from: v, to: todayStr })
              }}
              className="px-3 py-1.5 rounded-lg border border-sheen-muted/30 font-body text-xs text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold bg-sheen-cream"
            />
            <span className="font-body text-xs text-sheen-muted">To</span>
            <input
              type="date"
              value={range ? range.to : selectedDate}
              max={todayStr}
              onChange={(e) => {
                const v = e.target.value
                if (range) setRange({ ...range, to: v })
                else { setRange({ from: selectedDate, to: v }) }
              }}
              className="px-3 py-1.5 rounded-lg border border-sheen-muted/30 font-body text-xs text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold bg-sheen-cream"
            />
            <span className="font-body text-xs text-sheen-muted ml-2">
              {range
                ? `Viewing: ${format(parseISO(range.from), 'MMM d, yyyy')} → ${format(parseISO(range.to), 'MMM d, yyyy')}`
                : selectedDate === todayStr
                  ? 'Viewing: Today'
                  : `Viewing: ${format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}`}
            </span>
          </div>
        </div>

        {/* ---------- KPI Row ---------- */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {kpisLoading || costsLoading
            ? Array.from({ length: 5 }).map((_, i) => <KPISkeleton key={i} />)
            : kpiCards.map((card) => (
                <StatCard
                  key={card.title}
                  title={card.title}
                  value={card.value}
                  icon={card.icon}
                />
              ))}
        </section>

        {/* ---------- Charts + Sidebar ---------- */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Charts (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Revenue vs Expenses */}
            <div className="bg-sheen-white rounded-xl shadow-sm p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h2 className="font-display text-lg text-sheen-black">
                  {t('revenueVsExpenses')}
                </h2>
                {!range && (
                  <div className="flex gap-1.5">
                    {([7, 14, 30] as const).map(d => (
                      <button
                        key={d}
                        onClick={() => setChartPeriod(d)}
                        className={`px-4 py-1.5 rounded-full text-xs font-body font-medium transition-colors ${
                          chartPeriod === d
                            ? 'bg-sheen-brown text-white shadow-sm'
                            : 'bg-sheen-cream text-sheen-muted hover:bg-sheen-gold/10'
                        }`}
                      >
                        {d === 7 ? '7 Days' : d === 14 ? '14 Days' : '30 Days'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {revenueLoading ? (
                <Skeleton className="h-56 w-full" />
              ) : (
                <RevenueChart data={chartData ?? []} />
              )}
            </div>

            {/* Hourly Sales */}
            <div className="bg-sheen-white rounded-xl shadow-sm p-5">
              <h2 className="font-display text-lg text-sheen-black mb-4">
                {t('hourlySales')}
              </h2>
              <p className="font-body text-xs text-sheen-muted mb-3">
                {t('cupsByHour')}
              </p>
              {hourlyLoading ? (
                <Skeleton className="h-56 w-full" />
              ) : (
                <HourlyChart data={hourlySales ?? []} />
              )}
            </div>
          </div>

          {/* Right: Sidebar (1 col) */}
          <div className="space-y-6">
            {/* Sales by Source */}
            <div className="bg-sheen-white rounded-xl shadow-sm p-5">
              <h2 className="font-display text-lg text-sheen-black mb-4">Sales by Source</h2>
              {salesBySource.length === 0 ? (
                <p className="font-body text-sm text-sheen-muted">No sales recorded.</p>
              ) : (
                <div className="space-y-2">
                  {salesBySource.map((s) => (
                    <button
                      key={s.source}
                      onClick={() => setSourceDetail(s.source)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-sheen-cream/50 hover:bg-sheen-gold/10 transition-colors text-left"
                    >
                      <div className="flex flex-col">
                        <span className="font-body text-sm font-medium text-sheen-black">{s.source}</span>
                        <span className="font-body text-[10px] text-sheen-muted">{s.count} {s.count === 1 ? 'sale' : 'sales'} · {s.cups} cups</span>
                      </div>
                      <span className="font-display text-sm font-bold text-sheen-brown">{s.total.toFixed(2)} د.إ</span>
                    </button>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2 mt-2 border-t border-sheen-cream">
                    <span className="font-body text-xs font-semibold text-sheen-muted uppercase tracking-wider">Total</span>
                    <span className="font-display text-base font-bold text-sheen-brown">
                      {salesBySource.reduce((s, x) => s + x.total, 0).toFixed(2)} د.إ
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Top 5 Best Sellers */}
            <div className="bg-sheen-white rounded-xl shadow-sm p-5">
              <h2 className="font-display text-lg text-sheen-black mb-4">
                {t('topSellersToday')}
              </h2>
              {sellersLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (topSellers ?? []).length === 0 ? (
                <p className="font-body text-sm text-sheen-muted">
                  {t('noSalesYet')}
                </p>
              ) : (
                <ol className="space-y-3">
                  {(topSellers ?? [])
                    .slice(0, 5)
                    .map(
                      (
                        item: TopSeller,
                        idx: number,
                      ) => (
                        <li
                          key={item.name}
                          className="flex items-center gap-3 font-body text-sm"
                        >
                          <span
                            className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                              idx === 0
                                ? 'bg-sheen-gold text-sheen-black'
                                : idx === 1
                                  ? 'bg-sheen-muted/30 text-sheen-black'
                                  : idx === 2
                                    ? 'bg-amber-700/20 text-amber-800'
                                    : 'bg-sheen-cream text-sheen-muted'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-medium text-sheen-black">
                              {item.name}
                            </p>
                            <p className="text-xs text-sheen-muted">
                              {item.qty} {t('cups')}
                            </p>
                          </div>
                          <span className="text-sheen-brown font-semibold whitespace-nowrap">
                            {item.revenue.toFixed(2)} د.إ
                          </span>
                        </li>
                      ),
                    )}
                </ol>
              )}
            </div>

            {/* Fixed Cost Alerts */}
            <div className="bg-sheen-white rounded-xl shadow-sm p-5">
              <h2 className="font-display text-lg text-sheen-black mb-4">
                {t('costAlerts')}
              </h2>
              {costsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : upcomingAlerts.length === 0 ? (
                <p className="font-body text-sm text-sheen-muted">
                  {t('noUpcomingPayments')}
                </p>
              ) : (
                <ul className="space-y-3">
                  {upcomingAlerts.map(
                    (alert: FixedCost) => {
                      const dueDate = parseISO(alert.due_date!)
                      const overdue = isBefore(dueDate, today)

                      return (
                        <li
                          key={alert.id}
                          className={`rounded-lg border px-3 py-2.5 font-body text-sm ${
                            overdue
                              ? 'border-red-300 bg-red-50'
                              : 'border-amber-300 bg-amber-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sheen-black truncate">
                              {alert.description}
                            </span>
                            <span className="font-semibold text-sheen-brown whitespace-nowrap ml-2">
                              {alert.amount.toFixed(2)} د.إ
                            </span>
                          </div>
                          <p
                            className={`text-xs mt-0.5 ${
                              overdue ? 'text-red-600 font-semibold' : 'text-amber-700'
                            }`}
                          >
                            {overdue ? t('overdue') : t('due')}{' '}
                            {format(dueDate, 'MMM d, yyyy')}
                          </p>
                        </li>
                      )
                    },
                  )}
                </ul>
              )}
            </div>

            {/* AI Quick Insight */}
            <InsightCard
              insight={insight}
              isLoading={insightLoading}
              onRefresh={refreshInsight}
            />
          </div>
        </section>
      </main>

      {sourceDetail && (
        <SourceSalesModal
          source={sourceDetail}
          from={range ? range.from : selectedDate}
          to={range ? range.to : selectedDate}
          onClose={() => setSourceDetail(null)}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Source Sales Modal                                                 */
/* ------------------------------------------------------------------ */

function SourceSalesModal({
  source,
  from,
  to,
  onClose,
}: {
  source: string
  from: string
  to: string
  onClose: () => void
}) {
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales-by-source-detail', source, from, to],
    queryFn: async () => {
      const { data } = await api.get<(Sale & { sale_items: SaleItem[] })[]>(
        `/api/sales?from=${from}&to=${to}`,
      )
      const target = source.toLowerCase()
      return (data ?? []).filter(
        (s) => (s.recorded_by ?? 'POS').toLowerCase() === target,
      )
    },
    staleTime: 30_000,
  })

  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total_revenue), 0)
  const totalCups = sales.reduce((sum, s) => sum + Number(s.total_cups), 0)
  const rangeLabel =
    from === to
      ? format(parseISO(from), 'EEEE, MMMM d, yyyy')
      : `${format(parseISO(from), 'MMM d, yyyy')} → ${format(parseISO(to), 'MMM d, yyyy')}`

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 pt-20 sm:pt-4"
      onClick={onClose}
    >
      <div
        className="bg-sheen-white w-full sm:max-w-2xl max-h-[calc(100dvh-5rem)] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-sheen-cream">
          <div>
            <h3 className="font-display text-lg text-sheen-black">{source} Orders</h3>
            <p className="font-body text-xs text-sheen-muted">{rangeLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-sheen-cream transition-colors"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18" />
              <path d="M6 6L18 18" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 p-4 border-b border-sheen-cream bg-sheen-cream/30">
          <div>
            <p className="font-body text-[10px] uppercase tracking-wide text-sheen-muted">Orders</p>
            <p className="font-display text-lg font-bold text-sheen-black">{sales.length}</p>
          </div>
          <div>
            <p className="font-body text-[10px] uppercase tracking-wide text-sheen-muted">Cups</p>
            <p className="font-display text-lg font-bold text-sheen-black">{totalCups}</p>
          </div>
          <div>
            <p className="font-body text-[10px] uppercase tracking-wide text-sheen-muted">Revenue</p>
            <p className="font-display text-lg font-bold text-sheen-brown">
              {totalRevenue.toFixed(2)} د.إ
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <p className="font-body text-sm text-sheen-muted text-center py-6">Loading…</p>
          ) : sales.length === 0 ? (
            <p className="font-body text-sm text-sheen-muted text-center py-6">
              No orders for {source} in this range.
            </p>
          ) : (
            sales.map((sale) => {
              const uaeTime = new Date(sale.recorded_at)
              uaeTime.setHours(uaeTime.getHours() + 4)
              return (
                <div
                  key={sale.id}
                  className="rounded-lg border border-sheen-cream p-3 bg-sheen-cream/20"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-body text-xs text-sheen-muted">
                      {format(parseISO(sale.sale_date), 'MMM d')} ·{' '}
                      {uaeTime.toISOString().slice(11, 16)}
                    </span>
                    <span className="font-display text-sm font-bold text-sheen-brown">
                      {Number(sale.total_revenue).toFixed(2)} د.إ
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {(sale.sale_items ?? []).map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between font-body text-sm"
                      >
                        <span className="text-sheen-black truncate pr-2">
                          {item.name}
                          <span className="text-sheen-muted"> × {item.qty}</span>
                        </span>
                        <span className="text-sheen-muted whitespace-nowrap">
                          {Number(item.total).toFixed(2)} د.إ
                        </span>
                      </li>
                    ))}
                  </ul>
                  {sale.notes && (
                    <p className="font-body text-xs text-sheen-muted mt-2 italic">
                      {sale.notes}
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
