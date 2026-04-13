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
import type { FixedCost, TopSeller } from '../types'
import { format, addDays, isBefore, parseISO } from 'date-fns'

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
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['dashboard', 'kpis', selectedDate],
    queryFn: () => salesService.getDashboardKPIs(selectedDate),
    staleTime: 30_000,
  })
  const { data: hourlySales, isLoading: hourlyLoading } = useHourlySales(selectedDate)
  const { data: topSellers, isLoading: sellersLoading } = useTopSellers(selectedDate, 5)
  const [chartPeriod, setChartPeriod] = useState<7 | 14 | 30>(7)
  const { data: chartData, isLoading: revenueLoading } = useQuery({
    queryKey: ['dashboard', 'revenue-chart', chartPeriod],
    queryFn: () => salesService.getRevenueByDays(chartPeriod),
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
        {/* ---------- Date Picker ---------- */}
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            max={todayStr}
            onChange={(e) => setSelectedDate(e.target.value || todayStr)}
            className="px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold bg-sheen-white"
          />
          {selectedDate !== todayStr && (
            <button
              onClick={() => setSelectedDate(todayStr)}
              className="px-3 py-2 rounded-lg bg-sheen-brown text-white text-xs font-body font-medium hover:bg-sheen-brown/90 transition-colors"
            >
              Today
            </button>
          )}
          {selectedDate !== todayStr && (
            <span className="font-body text-xs text-sheen-muted">
              Viewing: {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}
            </span>
          )}
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
    </div>
  )
}
