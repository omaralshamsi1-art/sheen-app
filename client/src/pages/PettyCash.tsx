import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import TopBar from '../components/layout/TopBar'
import { useAuth } from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const PETTY_CATEGORIES = ['Transport', 'Cleaning', 'Supplies', 'Maintenance', 'Food', 'Printing', 'Other'] as const

interface PettyCashTx {
  id: string
  type: 'deposit' | 'withdrawal'
  amount: number
  description: string
  category: string | null
  date: string
  notes: string | null
  added_by: string | null
  recorded_at: string
}

export default function PettyCash() {
  const { user } = useAuth()
  const { isAdmin } = useRole()
  const qc = useQueryClient()
  const today = format(new Date(), 'yyyy-MM-dd')

  const [modal, setModal] = useState<'deposit' | 'withdrawal' | null>(null)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Supplies')
  const [date, setDate] = useState(today)
  const [notes, setNotes] = useState('')

  const { data: transactions = [], isLoading } = useQuery<PettyCashTx[]>({
    queryKey: ['petty-cash'],
    queryFn: async () => {
      const { data } = await api.get('/api/petty-cash')
      return data
    },
  })

  const addMut = useMutation({
    mutationFn: async (type: 'deposit' | 'withdrawal') => {
      await api.post('/api/petty-cash', {
        type,
        amount: Number(amount),
        description: description.trim(),
        category: type === 'withdrawal' ? category : null,
        date,
        notes: notes.trim() || undefined,
        added_by: user?.email || 'staff',
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['petty-cash'] })
      toast.success('Saved')
      setModal(null)
      setDescription('')
      setAmount('')
      setNotes('')
      setCategory('Supplies')
      setDate(today)
    },
    onError: () => toast.error('Failed'),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/petty-cash/${id}`) },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['petty-cash'] })
      toast.success('Deleted')
    },
  })

  const { totalDeposited, totalSpent, balance } = useMemo(() => {
    const totalDeposited = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + Number(t.amount), 0)
    const totalSpent = transactions.filter(t => t.type === 'withdrawal').reduce((s, t) => s + Number(t.amount), 0)
    return { totalDeposited, totalSpent, balance: totalDeposited - totalSpent }
  }, [transactions])

  const openModal = (type: 'deposit' | 'withdrawal') => {
    setDescription('')
    setAmount('')
    setNotes('')
    setCategory('Supplies')
    setDate(today)
    setModal(type)
  }

  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title="Petty Cash" />
      <main className="max-w-lg mx-auto px-4 py-6">

        {/* ── Balance Card ── */}
        <div className="bg-sheen-black rounded-2xl p-6 mb-6 text-white">
          <p className="font-body text-sm text-white/60 mb-1">Current Balance</p>
          <p className={`font-display text-4xl font-bold mb-4 ${balance < 0 ? 'text-red-400' : 'text-white'}`}>
            {balance.toFixed(2)} <span className="text-2xl">AED</span>
          </p>
          <div className="flex gap-4">
            <div>
              <p className="font-body text-xs text-white/50">Total Deposited</p>
              <p className="font-body text-sm text-green-400 font-semibold">+ {totalDeposited.toFixed(2)} AED</p>
            </div>
            <div className="w-px bg-white/20" />
            <div>
              <p className="font-body text-xs text-white/50">Total Spent</p>
              <p className="font-body text-sm text-red-400 font-semibold">− {totalSpent.toFixed(2)} AED</p>
            </div>
          </div>
        </div>

        {/* ── Action Buttons ── */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => openModal('deposit')}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 text-white font-body font-semibold text-sm hover:bg-green-600 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Deposit
          </button>
          <button
            onClick={() => openModal('withdrawal')}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-sheen-brown text-white font-body font-semibold text-sm hover:bg-sheen-brown/90 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Withdrawal
          </button>
        </div>

        {/* ── Transaction Log ── */}
        <div className="bg-sheen-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-sheen-muted/10">
            <h2 className="font-display text-base text-sheen-black">Transaction History</h2>
          </div>
          {isLoading ? (
            <p className="p-6 font-body text-sheen-muted text-center">Loading...</p>
          ) : transactions.length === 0 ? (
            <p className="p-6 font-body text-sheen-muted text-center">No transactions yet</p>
          ) : (
            <div className="divide-y divide-sheen-muted/10">
              {transactions.map(tx => (
                <div key={tx.id} className="px-4 py-3 flex items-center gap-3">
                  {/* Type indicator */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                    tx.type === 'deposit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'
                  }`}>
                    {tx.type === 'deposit' ? '+' : '−'}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm text-sheen-black font-medium leading-tight">{tx.description}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {tx.category && (
                        <span className="px-1.5 py-0.5 rounded bg-sheen-cream text-sheen-brown text-[10px] font-body">{tx.category}</span>
                      )}
                      <span className="font-body text-[10px] text-sheen-muted">{format(new Date(tx.date), 'dd MMM yyyy')}</span>
                      {tx.added_by && <span className="font-body text-[10px] text-sheen-muted">{tx.added_by.split('@')[0]}</span>}
                    </div>
                    {tx.notes && <p className="font-body text-[10px] text-sheen-muted mt-0.5">{tx.notes}</p>}
                  </div>

                  {/* Amount + delete */}
                  <div className="text-right shrink-0">
                    <p className={`font-body text-sm font-semibold ${tx.type === 'deposit' ? 'text-green-600' : 'text-red-500'}`}>
                      {tx.type === 'deposit' ? '+' : '−'}{Number(tx.amount).toFixed(2)}
                    </p>
                    {isAdmin && (
                      <button
                        onClick={() => deleteMut.mutate(tx.id)}
                        disabled={deleteMut.isPending}
                        className="text-sheen-muted hover:text-red-500 text-[10px] font-body transition-colors"
                      >
                        delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      {/* ── Modal ── */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold text-sheen-black mb-4">
              {modal === 'deposit' ? '+ Add Deposit' : '− Add Withdrawal'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block font-body text-xs text-sheen-muted mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={modal === 'deposit' ? 'e.g. Cash top-up' : 'e.g. Taxi, cleaning supplies...'}
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                />
              </div>

              <div>
                <label className="block font-body text-xs text-sheen-muted mb-1">Amount (AED)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                />
              </div>

              {modal === 'withdrawal' && (
                <div>
                  <label className="block font-body text-xs text-sheen-muted mb-1">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                  >
                    {PETTY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-body text-xs text-sheen-muted mb-1">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                  />
                </div>
                <div>
                  <label className="block font-body text-xs text-sheen-muted mb-1">Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setModal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-sheen-muted/30 font-body text-sm text-sheen-muted hover:bg-sheen-cream transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => addMut.mutate(modal)}
                  disabled={!description.trim() || !amount || addMut.isPending}
                  className={`flex-1 py-2.5 rounded-xl font-body text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
                    modal === 'deposit' ? 'bg-green-500 hover:bg-green-600' : 'bg-sheen-brown hover:bg-sheen-brown/90'
                  }`}
                >
                  {addMut.isPending ? 'Saving...' : modal === 'deposit' ? 'Add Deposit' : 'Add Withdrawal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
