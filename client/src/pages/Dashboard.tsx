import { useLanguage } from '../i18n/LanguageContext'
import { useDashboardKPIs, useHourlySales, useTopSellers, useLast7DaysRevenue } from '../hooks/useSales'
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
  const { data: kpis, isLoading: kpisLoading } = useDashboardKPIs()
  const { data: hourlySales, isLoading: hourlyLoading } = useHourlySales(todayStr)
  const { data: topSellers, isLoading: sellersLoading } = useTopSellers(todayStr, 5)
  const { data: last7Days, isLoading: revenueLoading } = useLast7DaysRevenue()
  const { data: fixedCosts, isLoading: costsLoading } = useFixedCosts()
  const { insight, isLoading: insightLoading, fetchInsight: refreshInsight } = useAutoInsight()

  /* ---- Derived values ---- */

  const totalRevenue = kpis?.total_revenue ?? 0
  const cupsSold = kpis?.total_cups ?? 0
  const totalExpenses = kpis?.total_expenses ?? 0

  // Net Profit = Revenue - Expenses - (Fixed Costs / 30)
  const monthlyFixedTotal =
    fixedCosts?.reduce(
      (sum: number, fc: { amount: number }) => sum + (fc.amount ?? 0),
      0,
    ) ?? 0
  const dailyFixedCost = monthlyFixedTotal / 30
  const netProfit = totalRevenue - totalExpenses - dailyFixedCost

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
      icon: '\u{1F4B0}',
    },
    {
      title: t('cupsSoldToday'),
      value: cupsSold.toLocaleString(),
      icon: '\u2615',
    },
    {
      title: t('totalExpensesToday'),
      value: `${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.إ`,
      icon: '\u{1F4C9}',
    },
    {
      title: t('netProfitToday'),
      value: `${netProfit >= 0 ? '' : '-'}${Math.abs(netProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.إ`,
      icon: '\u{1F4C8}',
    },
  ]

  /* ---- Render ---- */

  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title={t('dashboard')} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ---------- KPI Row ---------- */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpisLoading || costsLoading
            ? Array.from({ length: 4 }).map((_, i) => <KPISkeleton key={i} />)
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
            {/* Revenue vs Expenses -- Last 7 Days */}
            <div className="bg-sheen-white rounded-xl shadow-sm p-5">
              <h2 className="font-display text-lg text-sheen-black mb-4">
                {t('revenueVsExpenses')}
              </h2>
              <p className="font-body text-xs text-sheen-muted mb-3">{t('last7Days')}</p>
              {revenueLoading ? (
                <Skeleton className="h-56 w-full" />
              ) : (
                <RevenueChart data={last7Days ?? []} />
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
