import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import TopBar from '../components/layout/TopBar'
import Button from '../components/ui/Button'
import { useLanguage } from '../i18n/LanguageContext'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const PETTY_CATEGORIES = ['Transport', 'Cleaning', 'Supplies', 'Maintenance', 'Food', 'Printing', 'Other'] as const

interface PettyCashEntry {
  id: string
  expense_date: string
  ingredient_name: string
  category: string
  supplier: string | null
  unit: string | null
  qty_bought: number
  unit_cost: number
  total_cost: number
  notes: string | null
  added_by: string | null
  recorded_at: string
}

export default function PettyCash() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const qc = useQueryClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<string>('Supplies')
  const [date, setDate] = useState(today)
  const [notes, setNotes] = useState('')

  // Fetch petty cash expenses (category starts with "Petty:")
  const { data: entries = [], isLoading } = useQuery<PettyCashEntry[]>({
    queryKey: ['petty-cash'],
    queryFn: async () => {
      const { data } = await api.get('/api/expenses', { params: { from: format(new Date(new Date().setDate(1)), 'yyyy-MM-dd'), to: today } })
      return (data as PettyCashEntry[]).filter(e => e.category.startsWith('Petty:'))
    },
  })

  const addMut = useMutation({
    mutationFn: async () => {
      await api.post('/api/expenses', {
        expense_date: date,
        ingredient_name: description.trim(),
        category: `Petty: ${category}`,
        qty_bought: 1,
        unit: 'item',
        unit_cost: Number(amount),
        total_cost: Number(amount),
        notes: notes.trim() || undefined,
        added_by: user?.email || 'staff',
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['petty-cash'] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
      toast.success(t('save'))
      setDescription('')
      setAmount('')
      setNotes('')
      setCategory('Supplies')
    },
    onError: () => toast.error('Failed'),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/expenses/${id}`) },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['petty-cash'] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
      toast.success(t('delete'))
    },
  })

  const totalThisMonth = useMemo(() =>
    entries.reduce((s, e) => s + Number(e.total_cost), 0),
  [entries])

  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title={t('pettyCash')} />
      <main className="max-w-lg mx-auto px-4 py-6">

        {/* Add form */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-5 mb-4">
          <h2 className="font-display text-lg text-sheen-black mb-4">{t('addPettyCash')}</h2>
          <div className="space-y-3">
            <div>
              <label className="block font-body text-xs text-sheen-muted mb-1">{t('description')}</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                placeholder={t('pettyCashPlaceholder')}
                className="w-full px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-body text-xs text-sheen-muted mb-1">{t('amount')} (AED)</label>
                <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold" />
              </div>
              <div>
                <label className="block font-body text-xs text-sheen-muted mb-1">{t('category')}</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold">
                  {PETTY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-body text-xs text-sheen-muted mb-1">{t('date')}</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold" />
              </div>
              <div>
                <label className="block font-body text-xs text-sheen-muted mb-1">{t('notes')}</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold" />
              </div>
            </div>
            <Button onClick={() => addMut.mutate()} disabled={!description.trim() || !amount || addMut.isPending} className="w-full">
              {addMut.isPending ? t('saving') : t('addPettyCash')}
            </Button>
          </div>
        </div>

        {/* Monthly total */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-4 mb-4 flex items-center justify-between">
          <span className="font-body text-sm text-sheen-muted">{t('thisMonth')}</span>
          <span className="font-display text-xl font-bold text-sheen-brown">{totalThisMonth.toFixed(2)} AED</span>
        </div>

        {/* List */}
        <div className="bg-sheen-white rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <p className="p-6 font-body text-sheen-muted">{t('loading')}</p>
          ) : entries.length === 0 ? (
            <p className="p-6 font-body text-sheen-muted text-center">{t('noData')}</p>
          ) : (
            <div className="divide-y divide-sheen-muted/10">
              {entries.map(entry => (
                <div key={entry.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm text-sheen-black font-medium">{entry.ingredient_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded bg-sheen-cream text-sheen-brown text-[10px] font-body">{entry.category.replace('Petty: ', '')}</span>
                      <span className="font-body text-[10px] text-sheen-muted">{format(new Date(entry.expense_date), 'dd MMM')}</span>
                      {entry.added_by && <span className="font-body text-[10px] text-sheen-muted">{entry.added_by}</span>}
                    </div>
                    {entry.notes && <p className="font-body text-[10px] text-sheen-muted mt-0.5">{entry.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-body text-sm font-semibold text-sheen-brown">{Number(entry.total_cost).toFixed(2)}</p>
                    <button onClick={() => deleteMut.mutate(entry.id)} className="text-red-400 hover:text-red-600 text-[10px] font-body">{t('delete')}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
