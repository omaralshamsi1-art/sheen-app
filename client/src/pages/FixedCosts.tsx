import { useState, useMemo } from 'react'
import {
  useFixedCosts,
  useCreateFixedCost,
  useTogglePaid,
  useDeleteFixedCost,
  useMenuItems,
} from '../hooks/useFixedCosts'
import type { FixedCostCategory, FixedCostPayload } from '../types'
import TopBar from '../components/layout/TopBar'
import { useLanguage } from '../i18n/LanguageContext'
import Button from '../components/ui/Button'
import { format, isBefore, addDays, parseISO } from 'date-fns'

const CATEGORIES: FixedCostCategory[] = [
  'Rent',
  'Wages',
  'Utilities',
  'Internet',
  'Insurance',
  'Equipment',
  'Marketing',
  'Other',
]

const emptyForm: Omit<FixedCostPayload, 'month'> = {
  category: 'Rent',
  description: '',
  amount: 0,
  due_date: format(new Date(), 'yyyy-MM-dd'),
  notes: '',
}

export default function FixedCosts() {
  const { t } = useLanguage()
  const { data: costs = [], isLoading } = useFixedCosts()
  const createMutation = useCreateFixedCost()
  const togglePaidMutation = useTogglePaid()
  const deleteMutation = useDeleteFixedCost()
  const { data: menuItems = [] } = useMenuItems()

  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)

  // Derive month automatically from the due date
  const derivedMonth = form.due_date ? form.due_date.slice(0, 7) : format(new Date(), 'yyyy-MM')

  // Group costs by month, each group sorted by due date
  const grouped = useMemo(() => {
    const map = new Map<string, typeof costs>()
    const sorted = [...costs].sort(
      (a, b) => new Date(a.due_date ?? '').getTime() - new Date(b.due_date ?? '').getTime(),
    )
    for (const c of sorted) {
      const m = c.month
      if (!map.has(m)) map.set(m, [])
      map.get(m)!.push(c)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [costs])

  // Break-even: average gross margin per cup from menu items
  const averageGrossMarginPerCup = useMemo(() => {
    if (!menuItems.length) return 0
    const total = menuItems.reduce((sum, item) => {
      const margin =
        (item.selling_price ?? 0) - (item.estimated_cogs ?? 0) - (item.packaging_cost ?? 0)
      return sum + margin
    }, 0)
    return total / menuItems.length
  }, [menuItems])

  const currentMonth = format(new Date(), 'yyyy-MM')

  const totalMonthlyFixedCosts = useMemo(() => {
    return costs
      .filter((c) => c.month === currentMonth)
      .reduce((sum, c) => sum + Number(c.amount), 0)
  }, [costs, currentMonth])

  const breakEvenCups =
    averageGrossMarginPerCup > 0
      ? Math.ceil(totalMonthlyFixedCosts / averageGrossMarginPerCup)
      : null

  // Row background color based on status
  function rowColor(dueDate: string, paid: boolean): string {
    if (paid) return 'bg-green-50 border-green-200'
    const due = parseISO(dueDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (isBefore(due, today)) return 'bg-red-50 border-red-200'
    if (isBefore(due, addDays(today, 7))) return 'bg-yellow-50 border-yellow-200'
    return 'bg-white border-sheen-cream'
  }

  // Status label for a cost row
  function statusLabel(dueDate: string, paid: boolean): { text: string; className: string } {
    if (paid) return { text: t('paid'), className: 'bg-green-100 text-green-700' }
    const due = parseISO(dueDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (isBefore(due, today)) return { text: t('overdue'), className: 'bg-red-100 text-red-700' }
    return { text: t('pending'), className: 'bg-yellow-100 text-yellow-700' }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await createMutation.mutateAsync({
      ...form,
      amount: Number(form.amount),
      month: derivedMonth,
    })
    setForm(emptyForm)
    setShowForm(false)
  }

  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title={t('fixedCosts')} />

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Break-even calculator card */}
        <div className="rounded-xl bg-white shadow-sm p-5">
          <h2 className="font-display text-lg text-sheen-black mb-3">
            {t('breakEvenCalculator')}
            <span className="ml-2 text-sm font-body text-sheen-muted">({currentMonth})</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs font-body text-sheen-muted uppercase tracking-wide">
                {t('totalFixedCosts')}
              </p>
              <p className="font-display text-2xl text-sheen-black">
                د.إ {totalMonthlyFixedCosts.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs font-body text-sheen-muted uppercase tracking-wide">
                {t('avgMarginPerCup')}
              </p>
              <p className="font-display text-2xl text-sheen-black">
                د.إ {averageGrossMarginPerCup.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs font-body text-sheen-muted uppercase tracking-wide">
                {t('breakEvenCups')}
              </p>
              <p className="font-display text-2xl text-sheen-gold">
                {breakEvenCups !== null ? breakEvenCups.toLocaleString() : '\u2014'}
              </p>
            </div>
          </div>
        </div>

        {/* Add fixed cost toggle / form */}
        {!showForm ? (
          <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
            {t('addFixedCost')}
          </Button>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-xl bg-white shadow-sm p-5 space-y-4">
            <h2 className="font-display text-lg text-sheen-black">{t('newFixedCost')}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category */}
              <div>
                <label className="block text-sm font-body text-sheen-muted mb-1">{t('category')}</label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value as FixedCostCategory })
                  }
                  className="w-full rounded-lg border border-sheen-cream px-3 py-2 font-body text-sheen-black focus:outline-none focus:ring-2 focus:ring-sheen-gold"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-body text-sheen-muted mb-1">
                  {t('description')}
                </label>
                <input
                  type="text"
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-sheen-cream px-3 py-2 font-body text-sheen-black focus:outline-none focus:ring-2 focus:ring-sheen-gold"
                  placeholder="e.g. Monthly shop rent"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-body text-sheen-muted mb-1">
                  {`${t('amount')} (AED)`}
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  step="0.01"
                  value={form.amount || ''}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                  className="w-full rounded-lg border border-sheen-cream px-3 py-2 font-body text-sheen-black focus:outline-none focus:ring-2 focus:ring-sheen-gold"
                  placeholder="0.00"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-body text-sheen-muted mb-1">{t('dueDate')}</label>
                <input
                  type="date"
                  required
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full rounded-lg border border-sheen-cream px-3 py-2 font-body text-sheen-black focus:outline-none focus:ring-2 focus:ring-sheen-gold"
                />
                <p className="mt-1 text-xs font-body text-sheen-muted">
                  {`${t('month')}:`} <span className="font-semibold">{derivedMonth}</span>
                </p>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-body text-sheen-muted mb-1">{t('notes')}</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-sheen-cream px-3 py-2 font-body text-sheen-black focus:outline-none focus:ring-2 focus:ring-sheen-gold resize-none"
                placeholder="Optional notes..."
              />
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? t('saving') : t('save')}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setForm(emptyForm)
                }}
                className="text-sm font-body text-sheen-muted hover:text-sheen-black transition-colors"
              >
                {t('cancel')}
              </button>
            </div>
          </form>
        )}

        {/* Fixed costs list grouped by month */}
        {isLoading ? (
          <p className="text-center font-body text-sheen-muted py-12">{t('loadingFixedCosts')}</p>
        ) : grouped.length === 0 ? (
          <p className="text-center font-body text-sheen-muted py-12">
            {t('noFixedCostsYet')}
          </p>
        ) : (
          grouped.map(([month, items]) => {
            const monthTotal = items.reduce((s, c) => s + Number(c.amount), 0)
            const paidCount = items.filter((c) => c.is_paid).length

            return (
              <div key={month} className="space-y-3">
                {/* Month header with total */}
                <div className="flex items-center justify-between rounded-xl bg-white shadow-sm px-5 py-4">
                  <div>
                    <h3 className="font-display text-lg text-sheen-black">{month}</h3>
                    <p className="text-xs font-body text-sheen-muted">
                      {paidCount}/{items.length} {t('paid')}
                    </p>
                  </div>
                  <p className="font-display text-xl text-sheen-brown">
                    د.إ {monthTotal.toFixed(2)}
                  </p>
                </div>

                {/* Cost rows */}
                {items.map((cost) => {
                  const status = statusLabel(cost.due_date ?? '', cost.is_paid)

                  return (
                    <div
                      key={cost.id}
                      className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border px-5 py-4 shadow-sm transition-colors ${rowColor(cost.due_date ?? '', cost.is_paid)}`}
                    >
                      {/* Paid checkbox */}
                      <input
                        type="checkbox"
                        checked={cost.is_paid}
                        onChange={() => togglePaidMutation.mutate({ id: cost.id, is_paid: !cost.is_paid })}
                        className="h-5 w-5 shrink-0 accent-sheen-gold cursor-pointer"
                        title={cost.is_paid ? t('markAsUnpaid') : t('markAsPaid')}
                      />

                      {/* Category + description */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-block rounded-full bg-sheen-brown/10 px-2.5 py-0.5 text-xs font-body text-sheen-brown">
                            {cost.category}
                          </span>
                          <span className="font-body text-sm text-sheen-black truncate">
                            {cost.description}
                          </span>
                        </div>
                        {cost.notes && (
                          <p className="mt-1 text-xs font-body text-sheen-muted truncate">
                            {cost.notes}
                          </p>
                        )}
                      </div>

                      {/* Amount */}
                      <p className="font-display text-base text-sheen-black whitespace-nowrap">
                        د.إ {Number(cost.amount).toFixed(2)}
                      </p>

                      {/* Due date */}
                      <p className="text-xs font-body text-sheen-muted whitespace-nowrap">
                        {cost.due_date ? format(parseISO(cost.due_date), 'dd MMM yyyy') : t('noDate')}
                      </p>

                      {/* Status badge */}
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-body whitespace-nowrap ${status.className}`}
                      >
                        {status.text}
                      </span>

                      {/* Delete button */}
                      <button
                        onClick={() => deleteMutation.mutate(cost.id)}
                        disabled={deleteMutation.isPending}
                        className="shrink-0 rounded-lg p-1.5 text-sheen-muted hover:bg-red-50 hover:text-red-500 transition-colors"
                        title={t('delete')}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
