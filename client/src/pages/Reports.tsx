import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsService } from '../services/reportsService'
import TopBar from '../components/layout/TopBar'
import Button from '../components/ui/Button'
import CategoryPieChart from '../components/charts/CategoryPieChart'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { useLanguage } from '../i18n/LanguageContext'

// ── Helpers ──

function fmtCurrency(value: number): string {
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.إ`
}

function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function buildCSV(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v)
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [
    headers.map(escape).join(','),
    ...rows.map((r) => r.map(escape).join(',')),
  ].join('\n')
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ── Component ──

export default function Reports() {
  const { t } = useLanguage()
  const today = new Date()
  const [startDate, setStartDate] = useState(toDateString(startOfMonth(today)))
  const [endDate, setEndDate] = useState(toDateString(endOfMonth(today)))

  // ── Queries ──

  const { data: pnl, isLoading: pnlLoading } = useQuery({
    queryKey: ['reports', 'pnl', startDate, endDate],
    queryFn: () => reportsService.getPL(startDate, endDate),
  })

  const { data: revenueByCategory, isLoading: categoryLoading } = useQuery({
    queryKey: ['reports', 'revenueByCategory', startDate, endDate],
    queryFn: () => reportsService.getRevenueByCategory(startDate, endDate),
  })

  const { data: topSellers, isLoading: topSellersLoading } = useQuery({
    queryKey: ['reports', 'topSellers', startDate, endDate],
    queryFn: () => reportsService.getTopSellers(startDate, endDate),
  })

  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ['reports', 'expenses', startDate, endDate],
    queryFn: () => reportsService.getExpensesByCategory(startDate, endDate),
  })

  const { data: dailyRevenue, isLoading: dailyLoading } = useQuery({
    queryKey: ['reports', 'daily', startDate, endDate],
    queryFn: () => reportsService.getDailyRevenue(startDate, endDate),
  })

  // ── Derived values ──

  const netMargin = useMemo(() => {
    if (!pnl || !pnl.total_revenue) return 0
    return (pnl.net_profit / pnl.total_revenue) * 100
  }, [pnl])

  // ── Export ──

  const handleExportCSV = () => {
    if (!dailyRevenue) return

    const headers = ['Date', 'Revenue', 'Cups Sold']
    const rows = dailyRevenue.map((d: { date: string; revenue: number; cups: number }) => [
      d.date,
      d.revenue,
      d.cups,
    ])
    const csv = buildCSV(headers, rows)
    downloadCSV(`sheen-report-${startDate}-to-${endDate}.csv`, csv)
  }

  // ── Render ──

  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title={t('reports')} />

      <div className="mx-auto max-w-5xl space-y-6 p-4 pb-8">
        {/* ── Date Range Picker ── */}
        <section className="flex flex-wrap items-end gap-4 rounded-xl bg-sheen-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block font-body text-xs font-medium text-sheen-muted">
              {t('from')}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-sheen-cream bg-sheen-cream/40 px-3 py-2 font-body text-sm text-sheen-black focus:border-sheen-gold focus:outline-none focus:ring-1 focus:ring-sheen-gold"
            />
          </div>
          <div>
            <label className="mb-1 block font-body text-xs font-medium text-sheen-muted">
              {t('to')}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-sheen-cream bg-sheen-cream/40 px-3 py-2 font-body text-sm text-sheen-black focus:border-sheen-gold focus:outline-none focus:ring-1 focus:ring-sheen-gold"
            />
          </div>
          <Button onClick={handleExportCSV} disabled={!dailyRevenue}>
            {t('exportCSV')}
          </Button>
        </section>

        {/* ── P&L Summary ── */}
        <section className="rounded-xl bg-sheen-white p-5 shadow-sm">
          <h2 className="mb-4 font-display text-lg font-semibold text-sheen-black">
            {t('plSummary')}
          </h2>

          {pnlLoading ? (
            <Skeleton />
          ) : pnl ? (
            <div className="overflow-x-auto">
              <table className="w-full font-body text-sm">
                <tbody className="divide-y divide-sheen-cream">
                  <PnLRow label={t('totalRevenue')} value={fmtCurrency(pnl.total_revenue)} />
                  <PnLRow label={t('totalCOGSLabel')} value={fmtCurrency(pnl.total_cogs)} negative />
                  <PnLRow
                    label={t('grossProfit')}
                    value={fmtCurrency(pnl.gross_profit)}
                    bold
                  />
                  <PnLRow label={t('fixedCosts')} value={fmtCurrency(pnl.fixed_costs)} negative />
                  <PnLRow label={t('netProfit')} value={fmtCurrency(pnl.net_profit)} bold />
                  <PnLRow label={t('netMargin')} value={`${netMargin.toFixed(1)}%`} bold />
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState />
          )}
        </section>

        {/* ── Revenue by Category (Pie Chart) ── */}
        <section className="rounded-xl bg-sheen-white p-5 shadow-sm">
          <h2 className="mb-4 font-display text-lg font-semibold text-sheen-black">
            {t('revenueByCategory')}
          </h2>

          {categoryLoading ? (
            <Skeleton />
          ) : revenueByCategory && revenueByCategory.length > 0 ? (
            <div className="mx-auto max-w-md">
              <CategoryPieChart data={revenueByCategory} />
            </div>
          ) : (
            <EmptyState />
          )}
        </section>

        {/* ── Top 10 Best Sellers ── */}
        <section className="rounded-xl bg-sheen-white p-5 shadow-sm">
          <h2 className="mb-4 font-display text-lg font-semibold text-sheen-black">
            {t('top10BestSellers')}
          </h2>

          {topSellersLoading ? (
            <Skeleton />
          ) : topSellers && topSellers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full font-body text-sm">
                <thead>
                  <tr className="border-b border-sheen-cream text-left text-xs font-semibold uppercase tracking-wide text-sheen-muted">
                    <th className="pb-2 pr-4">#</th>
                    <th className="pb-2 pr-4">{t('item')}</th>
                    <th className="pb-2 pr-4 text-right">{t('qtySold')}</th>
                    <th className="pb-2 text-right">{t('revenue')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sheen-cream">
                  {topSellers.slice(0, 10).map(
                    (
                      item: { name: string; qty: number; revenue: number },
                      idx: number,
                    ) => (
                      <tr key={item.name} className="text-sheen-black">
                        <td className="py-2 pr-4 font-medium">{idx + 1}</td>
                        <td className="py-2 pr-4">{item.name}</td>
                        <td className="py-2 pr-4 text-right">{item.qty}</td>
                        <td className="py-2 text-right">{fmtCurrency(item.revenue)}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState />
          )}
        </section>

        {/* ── Expense Breakdown ── */}
        <section className="rounded-xl bg-sheen-white p-5 shadow-sm">
          <h2 className="mb-4 font-display text-lg font-semibold text-sheen-black">
            {t('expenseBreakdown')}
          </h2>

          {expensesLoading ? (
            <Skeleton />
          ) : expenses && expenses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full font-body text-sm">
                <thead>
                  <tr className="border-b border-sheen-cream text-left text-xs font-semibold uppercase tracking-wide text-sheen-muted">
                    <th className="pb-2 pr-4">{t('category')}</th>
                    <th className="pb-2 text-right">{t('amount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sheen-cream">
                  {expenses.map(
                    (exp: { category: string; total: number }) => (
                      <tr key={exp.category} className="text-sheen-black">
                        <td className="py-2 pr-4">{exp.category}</td>
                        <td className="py-2 text-right">{fmtCurrency(exp.total)}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState />
          )}
        </section>

        {/* ── Day-by-Day Revenue ── */}
        <section className="rounded-xl bg-sheen-white p-5 shadow-sm">
          <h2 className="mb-4 font-display text-lg font-semibold text-sheen-black">
            {t('dayByDayRevenue')}
          </h2>

          {dailyLoading ? (
            <Skeleton />
          ) : dailyRevenue && dailyRevenue.length > 0 ? (
            <div className="max-h-96 overflow-y-auto overflow-x-auto">
              <table className="w-full font-body text-sm">
                <thead className="sticky top-0 bg-sheen-white">
                  <tr className="border-b border-sheen-cream text-left text-xs font-semibold uppercase tracking-wide text-sheen-muted">
                    <th className="pb-2 pr-4">{t('date')}</th>
                    <th className="pb-2 pr-4 text-right">{t('revenue')}</th>
                    <th className="pb-2 text-right">{t('cups')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sheen-cream">
                  {dailyRevenue.map(
                    (day: { date: string; revenue: number; cups: number }) => (
                      <tr key={day.date} className="text-sheen-black">
                        <td className="py-2 pr-4">{day.date}</td>
                        <td className="py-2 pr-4 text-right">
                          {fmtCurrency(day.revenue)}
                        </td>
                        <td className="py-2 text-right">{day.cups}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState />
          )}
        </section>
      </div>
    </div>
  )
}

// ── Sub-components ──

function PnLRow({
  label,
  value,
  bold = false,
  negative = false,
}: {
  label: string
  value: string
  bold?: boolean
  negative?: boolean
}) {
  return (
    <tr>
      <td className={`py-2 pr-4 ${bold ? 'font-semibold' : ''} text-sheen-black`}>
        {label}
      </td>
      <td
        className={`py-2 text-right ${bold ? 'font-semibold' : ''} ${
          negative ? 'text-red-600' : 'text-sheen-black'
        }`}
      >
        {value}
      </td>
    </tr>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 w-3/4 rounded bg-sheen-cream" />
      <div className="h-4 w-1/2 rounded bg-sheen-cream" />
      <div className="h-4 w-2/3 rounded bg-sheen-cream" />
    </div>
  )
}

function EmptyState() {
  const { t } = useLanguage()
  return (
    <p className="py-6 text-center font-body text-sm text-sheen-muted">
      {t('noData')}
    </p>
  )
}
