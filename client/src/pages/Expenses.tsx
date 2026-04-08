import React, { useState, useMemo } from 'react'
import {
  useExpenses,
  useCreateExpense,
  useDeleteExpense,
  useIngredients,
  useExpenseSummary,
} from '../hooks/useExpenses'
import type { IngredientCategory, ExpensePayload } from '../types'
import TopBar from '../components/layout/TopBar'
import Button from '../components/ui/Button'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
} from 'date-fns'
import { useLanguage } from '../i18n/LanguageContext'
import StockAlert from '../components/StockAlert'

const EXPENSE_CATEGORIES: IngredientCategory[] = [
  'Coffee',
  'Dairy',
  'Matcha',
  'Packaging',
  'Fruit',
  'Syrup',
  'Baking',
  'Other',
]

const today = format(new Date(), 'yyyy-MM-dd')

interface FormState {
  date: string
  ingredient_name: string
  supplier: string
  quantity: number | ''
  unit: string
  unit_cost: number | ''
  category: IngredientCategory
}

const INITIAL_FORM: FormState = {
  date: today,
  ingredient_name: '',
  supplier: '',
  quantity: '',
  unit: '',
  unit_cost: '',
  category: 'Coffee',
}

export default function Expenses() {
  const { t } = useLanguage()
  const { data: ingredients = [] } = useIngredients()
  const createExpense = useCreateExpense()
  const deleteExpense = useDeleteExpense()

  // Form state
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Filter state
  const [filterStart, setFilterStart] = useState(
    format(startOfMonth(new Date()), 'yyyy-MM-dd'),
  )
  const [filterEnd, setFilterEnd] = useState(
    format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  )
  const [filterCategory, setFilterCategory] = useState<
    IngredientCategory | 'All'
  >('All')

  // Fetch expenses for filter range
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses({
    start: filterStart,
    end: filterEnd,
  })

  // Summary data
  const weeklySummary = useExpenseSummary({
    start: format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    end: format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  })

  const monthlySummary = useExpenseSummary({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  })

  // Auto-calculated total cost
  const totalCost = useMemo(() => {
    const qty = typeof form.quantity === 'number' ? form.quantity : 0
    const cost = typeof form.unit_cost === 'number' ? form.unit_cost : 0
    return qty * cost
  }, [form.quantity, form.unit_cost])

  // Ingredient name autocomplete suggestions
  const suggestions = useMemo(() => {
    if (!form.ingredient_name.trim()) return []
    const query = form.ingredient_name.toLowerCase()
    return ingredients
      .filter((ing: { name: string }) =>
        ing.name.toLowerCase().includes(query),
      )
      .slice(0, 8)
  }, [form.ingredient_name, ingredients])

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    if (filterCategory === 'All') return expenses
    return expenses.filter(
      (exp: { category: string }) => exp.category === filterCategory,
    )
  }, [expenses, filterCategory])

  // Form field updater
  const updateField = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Submit handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (
      !form.ingredient_name.trim() ||
      !form.quantity ||
      !form.unit.trim() ||
      form.unit_cost === ''
    ) {
      return
    }

    const payload: ExpensePayload = {
      expense_date: form.date,
      ingredient_name: form.ingredient_name.trim(),
      supplier: form.supplier.trim(),
      qty_bought: Number(form.quantity),
      unit: form.unit.trim(),
      unit_cost: Number(form.unit_cost),
      total_cost: totalCost,
      category: form.category,
    }

    createExpense.mutate(payload, {
      onSuccess: () => {
        setForm(INITIAL_FORM)
      },
    })
  }

  // CSV export
  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) return

    const headers = [
      'Date',
      'Ingredient',
      'Supplier',
      'Category',
      'Qty',
      'Unit',
      'Unit Cost',
      'Total Cost',
    ]

    const rows = filteredExpenses.map(
      (exp) => [
        exp.expense_date,
        `"${exp.ingredient_name}"`,
        `"${exp.supplier ?? ''}"`,
        exp.category,
        exp.qty_bought,
        exp.unit ?? '',
        exp.unit_cost,
        exp.total_cost,
      ],
    )

    const csv = [headers.join(','), ...rows.map((r: (string | number)[]) => r.join(','))].join(
      '\n',
    )

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sheen-expenses-${filterStart}-to-${filterEnd}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title={t('expenses')} />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="font-display text-3xl text-sheen-black mb-6">
          {t('expenses')}
        </h1>

        {/* ── Stock Levels ── */}
        <div className="mb-6">
          <StockAlert />
        </div>

        {/* ── New Expense Form ── */}
        <form
          onSubmit={handleSubmit}
          className="bg-sheen-white rounded-xl shadow-sm p-6 mb-8"
        >
          <h2 className="font-display text-xl text-sheen-black mb-4">
            {t('addExpense')}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Date */}
            <div>
              <label className="block font-body text-sm text-sheen-muted mb-1">
                {t('date')}
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => updateField('date', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 bg-sheen-cream font-body text-sm text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
              />
            </div>

            {/* Ingredient Name (dropdown) */}
            <div>
              <label className="block font-body text-sm text-sheen-muted mb-1">
                {t('ingredient')}
              </label>
              <select
                value={form.ingredient_name}
                onChange={(e) => {
                  const selected = ingredients.find((ing: { name: string }) => ing.name === e.target.value)
                  updateField('ingredient_name', e.target.value)
                  if (selected) {
                    updateField('unit', (selected as any).unit ?? '')
                    updateField('unit_cost', (selected as any).cost_per_unit ?? '')
                    updateField('category', (selected as any).category ?? 'Other')
                  }
                }}
                className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 bg-sheen-cream font-body text-sm text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
              >
                <option value="">{t('selectIngredient')}</option>
                {ingredients.map((ing: { id: string; name: string; category: string; unit: string }) => (
                  <option key={ing.id} value={ing.name}>
                    {ing.name} ({ing.unit})
                  </option>
                ))}
              </select>
            </div>

            {/* Supplier */}
            <div>
              <label className="block font-body text-sm text-sheen-muted mb-1">
                {t('supplier')}
              </label>
              <input
                type="text"
                value={form.supplier}
                onChange={(e) => updateField('supplier', e.target.value)}
                placeholder="e.g. Al Shaya"
                className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 bg-sheen-cream font-body text-sm text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block font-body text-sm text-sheen-muted mb-1">
                {t('category')}
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  updateField('category', e.target.value as IngredientCategory)
                }
                className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 bg-sheen-cream font-body text-sm text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block font-body text-sm text-sheen-muted mb-1">
                {t('quantity')}
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={form.quantity}
                onChange={(e) =>
                  updateField(
                    'quantity',
                    e.target.value === '' ? '' : Number(e.target.value),
                  )
                }
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 bg-sheen-cream font-body text-sm text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
              />
            </div>

            {/* Unit */}
            <div>
              <label className="block font-body text-sm text-sheen-muted mb-1">
                {t('unit')}
              </label>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => updateField('unit', e.target.value)}
                placeholder="e.g. L, kg, pcs"
                className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 bg-sheen-cream font-body text-sm text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
              />
            </div>

            {/* Unit Cost */}
            <div>
              <label className="block font-body text-sm text-sheen-muted mb-1">
                {t('unitCost')} (د.إ)
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={form.unit_cost}
                onChange={(e) =>
                  updateField(
                    'unit_cost',
                    e.target.value === '' ? '' : Number(e.target.value),
                  )
                }
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 bg-sheen-cream font-body text-sm text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
              />
            </div>

            {/* Total Cost (auto-calculated, read-only) */}
            <div>
              <label className="block font-body text-sm text-sheen-muted mb-1">
                {t('totalCost')} (د.إ)
              </label>
              <div className="w-full px-3 py-2 rounded-lg border border-sheen-muted/20 bg-sheen-cream/50 font-body text-sm text-sheen-brown font-semibold">
                {totalCost.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <Button
              type="submit"
              disabled={
                createExpense.isPending ||
                !form.ingredient_name.trim() ||
                !form.quantity ||
                !form.unit.trim() ||
                form.unit_cost === ''
              }
            >
              {createExpense.isPending ? t('saving') : t('addExpense')}
            </Button>
          </div>
        </form>

        {/* ── Weekly / Monthly Summary ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Weekly */}
          <div className="bg-sheen-white rounded-xl shadow-sm p-5">
            <h3 className="font-display text-lg text-sheen-black mb-3">
              {t('thisWeek')}
            </h3>
            {weeklySummary.isLoading ? (
              <p className="font-body text-sm text-sheen-muted">{t('loading')}</p>
            ) : (
              <div className="space-y-2">
                {EXPENSE_CATEGORIES.map((cat) => {
                  const entry = (weeklySummary.data ?? []).find(
                    (e: { category: string }) => e.category === cat,
                  )
                  const amount = entry?.total ?? 0
                  if (amount === 0) return null
                  return (
                    <div
                      key={cat}
                      className="flex items-center justify-between font-body text-sm"
                    >
                      <span className="text-sheen-black">{cat}</span>
                      <span className="text-sheen-brown font-medium">
                        {Number(amount).toFixed(2)} د.إ
                      </span>
                    </div>
                  )
                })}
                <div className="border-t border-sheen-muted/20 pt-2 flex items-center justify-between font-body text-sm font-semibold">
                  <span className="text-sheen-black">{t('total')}</span>
                  <span className="text-sheen-brown">
                    {(weeklySummary.data ?? [])
                      .reduce((a: number, b: { total: number }) => a + Number(b.total), 0)
                      .toFixed(2)}{' '}
                    د.إ
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Monthly */}
          <div className="bg-sheen-white rounded-xl shadow-sm p-5">
            <h3 className="font-display text-lg text-sheen-black mb-3">
              {t('thisMonth')}
            </h3>
            {monthlySummary.isLoading ? (
              <p className="font-body text-sm text-sheen-muted">{t('loading')}</p>
            ) : (
              <div className="space-y-2">
                {EXPENSE_CATEGORIES.map((cat) => {
                  const entry = (monthlySummary.data ?? []).find(
                    (e: { category: string }) => e.category === cat,
                  )
                  const amount = entry?.total ?? 0
                  if (amount === 0) return null
                  return (
                    <div
                      key={cat}
                      className="flex items-center justify-between font-body text-sm"
                    >
                      <span className="text-sheen-black">{cat}</span>
                      <span className="text-sheen-brown font-medium">
                        {Number(amount).toFixed(2)} د.إ
                      </span>
                    </div>
                  )
                })}
                <div className="border-t border-sheen-muted/20 pt-2 flex items-center justify-between font-body text-sm font-semibold">
                  <span className="text-sheen-black">{t('total')}</span>
                  <span className="text-sheen-brown">
                    {(monthlySummary.data ?? [])
                      .reduce((a: number, b: { total: number }) => a + Number(b.total), 0)
                      .toFixed(2)}{' '}
                    د.إ
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Expense Log with Filters ── */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
            <h2 className="font-display text-xl text-sheen-black flex-1">
              {t('expenseLog')}
            </h2>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block font-body text-xs text-sheen-muted mb-1">
                  {t('from')}
                </label>
                <input
                  type="date"
                  value={filterStart}
                  onChange={(e) => setFilterStart(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border border-sheen-muted/40 bg-sheen-cream font-body text-sm text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                />
              </div>
              <div>
                <label className="block font-body text-xs text-sheen-muted mb-1">
                  {t('to')}
                </label>
                <input
                  type="date"
                  value={filterEnd}
                  onChange={(e) => setFilterEnd(e.target.value)}
                  className="px-2 py-1.5 rounded-lg border border-sheen-muted/40 bg-sheen-cream font-body text-sm text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                />
              </div>
              <div>
                <label className="block font-body text-xs text-sheen-muted mb-1">
                  {t('category')}
                </label>
                <select
                  value={filterCategory}
                  onChange={(e) =>
                    setFilterCategory(
                      e.target.value as IngredientCategory | 'All',
                    )
                  }
                  className="px-2 py-1.5 rounded-lg border border-sheen-muted/40 bg-sheen-cream font-body text-sm text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                >
                  <option value="All">All</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                onClick={handleExportCSV}
                disabled={filteredExpenses.length === 0}
              >
                {t('exportCSV')}
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-sheen-muted/30">
                  {[
                    t('date'),
                    t('ingredient'),
                    t('supplier'),
                    t('category'),
                    t('quantity'),
                    t('unit'),
                    t('unitCost'),
                    t('total'),
                    '',
                  ].map((h) => (
                    <th
                      key={h}
                      className="pb-2 pr-3 font-body text-xs text-sheen-muted font-medium whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expensesLoading ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="py-6 text-center font-body text-sm text-sheen-muted"
                    >
                      {t('loadingExpenses')}
                    </td>
                  </tr>
                ) : filteredExpenses.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="py-6 text-center font-body text-sm text-sheen-muted"
                    >
                      {t('noExpensesFound')}
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map(
                    (exp) => (
                      <tr
                        key={exp.id}
                        className="border-b border-sheen-muted/10 hover:bg-sheen-cream/40 transition-colors"
                      >
                        <td className="py-2.5 pr-3 font-body text-sm text-sheen-black whitespace-nowrap">
                          {format(new Date(exp.expense_date), 'dd MMM')}
                        </td>
                        <td className="py-2.5 pr-3 font-body text-sm text-sheen-black">
                          {exp.ingredient_name}
                        </td>
                        <td className="py-2.5 pr-3 font-body text-sm text-sheen-muted">
                          {exp.supplier || '—'}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="inline-block px-2 py-0.5 rounded-full bg-sheen-cream text-sheen-brown text-xs font-body font-medium">
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 font-body text-sm text-sheen-black">
                          {exp.qty_bought}
                        </td>
                        <td className="py-2.5 pr-3 font-body text-sm text-sheen-muted">
                          {exp.unit}
                        </td>
                        <td className="py-2.5 pr-3 font-body text-sm text-sheen-black">
                          {Number(exp.unit_cost).toFixed(2)}
                        </td>
                        <td className="py-2.5 pr-3 font-body text-sm text-sheen-brown font-medium">
                          {Number(exp.total_cost).toFixed(2)}
                        </td>
                        <td className="py-2.5">
                          <button
                            onClick={() => deleteExpense.mutate(exp.id)}
                            disabled={deleteExpense.isPending}
                            className="text-red-500 hover:text-red-700 text-xs font-body transition-colors disabled:opacity-50"
                          >
                            {t('delete')}
                          </button>
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* Table footer total */}
          {filteredExpenses.length > 0 && (
            <div className="mt-4 pt-3 border-t border-sheen-muted/20 flex justify-between items-center">
              <p className="font-body text-sm text-sheen-muted">
                {filteredExpenses.length} {filteredExpenses.length !== 1 ? t('expensePlural') : t('expense')}
              </p>
              <p className="font-body text-sm font-semibold text-sheen-brown">
                {t('total')}:{' '}
                {filteredExpenses
                  .reduce(
                    (sum: number, exp: { total_cost: number }) =>
                      sum + Number(exp.total_cost),
                    0,
                  )
                  .toFixed(2)}{' '}
                د.إ
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
