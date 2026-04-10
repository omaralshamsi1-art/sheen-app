import React, { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  useExpenses,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
  useIngredients,
  useExpenseSummary,
} from '../hooks/useExpenses'
import type { IngredientCategory, ExpensePayload, Expense } from '../types'
import TopBar from '../components/layout/TopBar'
import Modal from '../components/ui/Modal'
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
import api from '../lib/api'

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
  packs: number | ''
}

const INITIAL_FORM: FormState = {
  date: today,
  ingredient_name: '',
  supplier: '',
  quantity: '',
  packs: '',
  unit: 'grams',
  unit_cost: '',
  category: 'Coffee',
}

export default function Expenses() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const { data: ingredients = [] } = useIngredients()
  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()
  const deleteExpense = useDeleteExpense()
  const [customPackSize, setCustomPackSize] = useState<string>('')
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [editForm, setEditForm] = useState({ ingredient_name: '', qty_bought: '', unit: '', unit_cost: '', total_cost: '', supplier: '', notes: '' })

  // Form state
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false)

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

  // (effectiveQty and totalCost moved below after packSizeNum)

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

  // Selected ingredient info (for pack conversion)
  const selectedIngredient = useMemo(() => {
    return ingredients.find((ing: { name: string }) =>
      ing.name.toLowerCase() === form.ingredient_name.trim().toLowerCase()
    ) as any | undefined
  }, [form.ingredient_name, ingredients])

  // Parse pack size number — use custom override if set, otherwise from ingredient
  const packSizeNum = useMemo(() => {
    if (customPackSize) return Number(customPackSize) || 0
    if (!selectedIngredient?.pack_size) return 0
    const match = String(selectedIngredient.pack_size).match(/(\d+)/)
    return match ? Number(match[1]) : 0
  }, [selectedIngredient, customPackSize])

  // Auto-calculate quantity from packs if ingredient has pack_size
  const effectiveQty = useMemo(() => {
    if (form.packs && packSizeNum > 0) {
      return Number(form.packs) * packSizeNum
    }
    return typeof form.quantity === 'number' ? form.quantity : 0
  }, [form.packs, form.quantity, packSizeNum])

  // Auto-calculated total cost
  const totalCost = useMemo(() => {
    const cost = typeof form.unit_cost === 'number' ? form.unit_cost : 0
    return effectiveQty * cost
  }, [effectiveQty, form.unit_cost])

  // Supplier autocomplete from past expenses
  const supplierSuggestions = useMemo(() => {
    const allSuppliers = expenses
      .map((exp: { supplier: string | null }) => exp.supplier)
      .filter(Boolean) as string[]
    const unique = [...new Set(allSuppliers)]
    if (!form.supplier.trim()) return unique.slice(0, 8)
    const query = form.supplier.toLowerCase()
    return unique.filter(s => s.toLowerCase().includes(query)).slice(0, 8)
  }, [form.supplier, expenses])

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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (
      !form.ingredient_name.trim() ||
      (!form.quantity && !form.packs) ||
      !form.unit.trim() ||
      form.unit_cost === ''
    ) {
      return
    }

    // Auto-create ingredient if it doesn't exist
    const ingredientName = form.ingredient_name.trim()
    const exists = ingredients.some((ing: { name: string }) => ing.name.toLowerCase() === ingredientName.toLowerCase())
    if (!exists) {
      try {
        await api.post('/api/ingredients', {
          name: ingredientName,
          category: form.category,
          unit: form.unit.trim(),
          pack_cost: 0,
          cost_per_unit: Number(form.unit_cost) || 0,
        })
        queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      } catch { /* ignore — expense still records */ }
    }

    const payload: ExpensePayload = {
      expense_date: form.date,
      ingredient_name: ingredientName,
      supplier: form.supplier.trim(),
      qty_bought: effectiveQty,
      unit: form.unit.trim(),
      unit_cost: Number(form.unit_cost),
      total_cost: totalCost,
      category: form.category,
    }

    createExpense.mutate(payload, {
      onSuccess: () => {
        setForm(INITIAL_FORM)
        setCustomPackSize('')
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

            {/* Ingredient Name (with autocomplete) */}
            <div className="relative">
              <label className="block font-body text-sm text-sheen-muted mb-1">
                {t('ingredient')}
              </label>
              <input
                type="text"
                value={form.ingredient_name}
                onChange={(e) => {
                  updateField('ingredient_name', e.target.value)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="e.g. Oat Milk"
                className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 bg-sheen-cream font-body text-sm text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
              />
              {showSuggestions && form.ingredient_name.trim() && (
                <ul className="absolute z-10 left-0 right-0 top-full mt-1 bg-sheen-white border border-sheen-muted/30 rounded-lg shadow-md max-h-40 overflow-y-auto">
                  {suggestions.map((ing: { id: string; name: string }) => (
                    <li
                      key={ing.id}
                      onMouseDown={() => {
                        updateField('ingredient_name', ing.name)
                        const full = ing as any
                        if (full.unit) updateField('unit', full.unit)
                        if (full.cost_per_unit) updateField('unit_cost', full.cost_per_unit)
                        if (full.category) updateField('category', full.category)
                        setCustomPackSize('')
                        updateField('packs', '')
                        setShowSuggestions(false)
                      }}
                      className="px-3 py-2 font-body text-sm text-sheen-black hover:bg-sheen-gold/10 cursor-pointer"
                    >
                      {ing.name}
                    </li>
                  ))}
                  {!ingredients.some((ing: { name: string }) => ing.name.toLowerCase() === form.ingredient_name.trim().toLowerCase()) && (
                    <li
                      onMouseDown={() => setShowSuggestions(false)}
                      className="px-3 py-2 font-body text-xs text-sheen-gold border-t border-sheen-cream"
                    >
                      + "{form.ingredient_name.trim()}" {t('willBeCreated')}
                    </li>
                  )}
                </ul>
              )}
            </div>

            {/* Supplier (with autocomplete) */}
            <div className="relative">
              <label className="block font-body text-sm text-sheen-muted mb-1">
                {t('supplier')}
              </label>
              <input
                type="text"
                value={form.supplier}
                onChange={(e) => {
                  updateField('supplier', e.target.value)
                  setShowSupplierSuggestions(true)
                }}
                onFocus={() => setShowSupplierSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 150)}
                placeholder="e.g. Al Shaya"
                className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 bg-sheen-cream font-body text-sm text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
              />
              {showSupplierSuggestions && supplierSuggestions.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 top-full mt-1 bg-sheen-white border border-sheen-muted/30 rounded-lg shadow-md max-h-40 overflow-y-auto">
                  {supplierSuggestions.map((name: string) => (
                    <li
                      key={name}
                      onMouseDown={() => {
                        updateField('supplier', name)
                        setShowSupplierSuggestions(false)
                      }}
                      className="px-3 py-2 font-body text-sm text-sheen-black hover:bg-sheen-gold/10 cursor-pointer"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              )}
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

            {/* Packs + Pack Size or raw Quantity */}
            {selectedIngredient ? (
              <>
                <div>
                  <label className="block font-body text-sm text-sheen-muted mb-1">
                    {t('packs')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={form.packs}
                    onChange={(e) => updateField('packs', e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 bg-sheen-cream font-body text-sm text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                  />
                  {form.packs && packSizeNum > 0 && (
                    <p className="font-body text-[10px] text-sheen-gold mt-1">
                      = {effectiveQty.toLocaleString()} {selectedIngredient.unit}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block font-body text-sm text-sheen-muted mb-1">
                    {t('packSize')} ({selectedIngredient.unit})
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={customPackSize || (packSizeNum > 0 ? packSizeNum : '')}
                    onChange={(e) => setCustomPackSize(e.target.value)}
                    placeholder={selectedIngredient.pack_size || '1000'}
                    className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 bg-sheen-cream font-body text-sm text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block font-body text-sm text-sheen-muted mb-1">
                  {t('quantity')}
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={form.quantity}
                  onChange={(e) => updateField('quantity', e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 bg-sheen-cream font-body text-sm text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                />
              </div>
            )}

            {/* Unit */}
            <div>
              <label className="block font-body text-sm text-sheen-muted mb-1">
                {t('unit')}
              </label>
              <select
                value={form.unit}
                onChange={(e) => updateField('unit', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 bg-sheen-cream font-body text-sm text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
              >
                <option value="grams">grams</option>
                <option value="ml">ml</option>
                <option value="piece">piece</option>
                <option value="kg">kg</option>
                <option value="L">L</option>
                <option value="box">box</option>
                <option value="item">item</option>
              </select>
            </div>

            {/* Unit Cost or Pack Cost */}
            <div>
              <label className="block font-body text-sm text-sheen-muted mb-1">
                {selectedIngredient && packSizeNum > 0 ? t('packCost') : t('unitCost')} (د.إ)
              </label>
              {selectedIngredient && packSizeNum > 0 ? (
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.unit_cost ? (Number(form.unit_cost) * packSizeNum).toFixed(2) : ''}
                  onChange={(e) => {
                    const packCost = Number(e.target.value) || 0
                    updateField('unit_cost', packSizeNum > 0 ? packCost / packSizeNum : 0)
                  }}
                  placeholder={selectedIngredient.pack_cost ? String(selectedIngredient.pack_cost) : '0.00'}
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 bg-sheen-cream font-body text-sm text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                />
              ) : (
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={form.unit_cost}
                  onChange={(e) => updateField('unit_cost', e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 bg-sheen-cream font-body text-sm text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                />
              )}
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
                (!form.quantity && !form.packs) ||
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
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => {
                                setEditExpense(exp)
                                setEditForm({
                                  ingredient_name: exp.ingredient_name,
                                  qty_bought: String(exp.qty_bought),
                                  unit: exp.unit ?? '',
                                  unit_cost: String(exp.unit_cost),
                                  total_cost: String(exp.total_cost),
                                  supplier: exp.supplier ?? '',
                                  notes: exp.notes ?? '',
                                })
                              }}
                              className="text-sheen-gold hover:text-sheen-brown text-xs font-body font-medium transition-colors"
                            >
                              {t('edit')}
                            </button>
                            <button
                              onClick={() => deleteExpense.mutate(exp.id)}
                              disabled={deleteExpense.isPending}
                              className="text-red-500 hover:text-red-700 text-xs font-body transition-colors disabled:opacity-50"
                            >
                              {t('delete')}
                            </button>
                          </div>
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

      {/* Edit Expense Modal */}
      {editExpense && (
        <Modal open={true} title={`${t('edit')}: ${editExpense.ingredient_name}`} onClose={() => setEditExpense(null)}>
          <div className="space-y-3">
            <div>
              <label className="block font-body text-xs text-sheen-muted mb-1">{t('ingredient')}</label>
              <input type="text" value={editForm.ingredient_name} onChange={e => setEditForm({ ...editForm, ingredient_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-body text-xs text-sheen-muted mb-1">{t('quantity')}</label>
                <input type="number" min="0" step="any" value={editForm.qty_bought} onChange={e => {
                  const qty = e.target.value
                  const total = (Number(qty) * Number(editForm.unit_cost)).toFixed(2)
                  setEditForm({ ...editForm, qty_bought: qty, total_cost: total })
                }}
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold" />
              </div>
              <div>
                <label className="block font-body text-xs text-sheen-muted mb-1">{t('unit')}</label>
                <select value={editForm.unit} onChange={e => setEditForm({ ...editForm, unit: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold">
                  <option value="grams">grams</option>
                  <option value="ml">ml</option>
                  <option value="piece">piece</option>
                  <option value="kg">kg</option>
                  <option value="L">L</option>
                  <option value="box">box</option>
                  <option value="item">item</option>
                </select>
              </div>
              <div>
                <label className="block font-body text-xs text-sheen-muted mb-1">{t('unitCost')}</label>
                <input type="number" min="0" step="any" value={editForm.unit_cost} onChange={e => {
                  const cost = e.target.value
                  const total = (Number(editForm.qty_bought) * Number(cost)).toFixed(2)
                  setEditForm({ ...editForm, unit_cost: cost, total_cost: total })
                }}
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold" />
              </div>
            </div>
            <div>
              <label className="block font-body text-xs text-sheen-muted mb-1">{t('totalCost')}</label>
              <div className="px-3 py-2 rounded-lg bg-sheen-cream/50 font-body text-sm text-sheen-brown font-semibold">
                {Number(editForm.total_cost).toFixed(2)} د.إ
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-body text-xs text-sheen-muted mb-1">{t('supplier')}</label>
                <input type="text" value={editForm.supplier} onChange={e => setEditForm({ ...editForm, supplier: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold" />
              </div>
              <div>
                <label className="block font-body text-xs text-sheen-muted mb-1">{t('notes')}</label>
                <input type="text" value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={() => {
                updateExpense.mutate({
                  id: editExpense.id,
                  updates: {
                    ingredient_name: editForm.ingredient_name.trim(),
                    qty_bought: Number(editForm.qty_bought),
                    unit: editForm.unit.trim() || null,
                    unit_cost: Number(editForm.unit_cost),
                    total_cost: Number(editForm.total_cost),
                    supplier: editForm.supplier.trim() || null,
                    notes: editForm.notes.trim() || null,
                  },
                }, { onSuccess: () => setEditExpense(null) })
              }} disabled={updateExpense.isPending}>
                {updateExpense.isPending ? t('saving') : t('saveChanges')}
              </Button>
              <button onClick={() => setEditExpense(null)} className="text-sm font-body text-sheen-muted hover:text-sheen-black">{t('cancel')}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
