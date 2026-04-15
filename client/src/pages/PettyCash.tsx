import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { supabase } from '../lib/supabase'
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
  receipt_url?: string | null
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
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)

  // Scan receipt image with AI → auto-fill form fields
  const scanReceipt = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('AI scan works on image files only')
      return
    }
    setScanning(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const { data } = await api.post('/api/ai/read-receipt', { image: base64 })
      if (data.amount) setAmount(String(data.amount))
      if (data.description) setDescription(data.description)
      if (data.category && PETTY_CATEGORIES.includes(data.category)) setCategory(data.category)
      if (data.date) setDate(data.date)

      // Build notes from supplier + phone (both optional)
      const notesParts: string[] = []
      if (data.supplier) notesParts.push(`Supplier: ${data.supplier}`)
      if (data.phone) notesParts.push(`Phone: ${data.phone}`)
      if (notesParts.length > 0) setNotes(notesParts.join(' · '))

      toast.success('Bill scanned and filled')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to scan bill')
    }
    setScanning(false)
  }

  const { data: transactions = [], isLoading } = useQuery<PettyCashTx[]>({
    queryKey: ['petty-cash'],
    queryFn: async () => {
      const { data } = await api.get('/api/petty-cash')
      return data
    },
  })

  const addMut = useMutation({
    mutationFn: async (type: 'deposit' | 'withdrawal') => {
      let receipt_url: string | undefined

      // Upload receipt if one was selected (only meaningful for withdrawals)
      if (receiptFile && type === 'withdrawal') {
        setUploadingReceipt(true)
        try {
          const ext = receiptFile.name.split('.').pop()?.toLowerCase() || 'jpg'
          const filePath = `petty-${Date.now()}.${ext}`
          const { error: uploadErr } = await supabase.storage
            .from('menu-images')
            .upload(filePath, receiptFile, { upsert: true, cacheControl: '3600' })
          if (uploadErr) throw uploadErr
          const { data: urlData } = supabase.storage.from('menu-images').getPublicUrl(filePath)
          receipt_url = urlData.publicUrl
        } finally {
          setUploadingReceipt(false)
        }
      }

      await api.post('/api/petty-cash', {
        type,
        amount: Number(amount),
        description: description.trim(),
        category: type === 'withdrawal' ? category : null,
        date,
        notes: notes.trim() || undefined,
        added_by: user?.email || 'staff',
        receipt_url,
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
      setReceiptFile(null)
      setReceiptPreview(null)
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
    setReceiptFile(null)
    setReceiptPreview(null)
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
                    {tx.receipt_url && (
                      <button
                        onClick={() => setLightboxImg(tx.receipt_url!)}
                        className="mt-1 inline-flex items-center gap-1 text-[10px] font-body text-sheen-gold hover:text-sheen-brown transition-colors"
                      >
                        📎 View receipt
                      </button>
                    )}
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

              {/* Receipt attachment — withdrawals only */}
              {modal === 'withdrawal' && (
                <div>
                  <label className="block font-body text-xs text-sheen-muted mb-1">Receipt (optional)</label>
                  {receiptPreview ? (
                    <div>
                      <div className="relative mb-2">
                        <img
                          src={receiptPreview}
                          alt="Receipt preview"
                          className="w-full max-h-48 object-contain rounded-lg border border-sheen-muted/20 bg-sheen-cream"
                        />
                        <button
                          onClick={() => { setReceiptFile(null); setReceiptPreview(null) }}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white text-xs font-bold hover:bg-red-600"
                        >
                          ✕
                        </button>
                      </div>
                      <button
                        onClick={() => receiptFile && scanReceipt(receiptFile)}
                        disabled={scanning || !receiptFile}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-sheen-gold text-white font-body text-xs font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-60"
                      >
                        {scanning ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                            Reading bill...
                          </>
                        ) : (
                          <>🤖 Scan with AI to fill form</>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-dashed border-sheen-muted/40 cursor-pointer hover:border-sheen-gold hover:bg-sheen-gold/5 transition-colors">
                        <svg className="w-5 h-5 text-sheen-muted" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span className="font-body text-xs text-sheen-muted">Take photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (!f) return
                            setReceiptFile(f)
                            setReceiptPreview(URL.createObjectURL(f))
                          }}
                          className="hidden"
                        />
                      </label>
                      <label className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-dashed border-sheen-muted/40 cursor-pointer hover:border-sheen-gold hover:bg-sheen-gold/5 transition-colors">
                        <svg className="w-5 h-5 text-sheen-muted" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span className="font-body text-xs text-sheen-muted">Upload file</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (!f) return
                            setReceiptFile(f)
                            setReceiptPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : '/images/logo.png')
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
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
                  disabled={!description.trim() || !amount || addMut.isPending || uploadingReceipt}
                  className={`flex-1 py-2.5 rounded-xl font-body text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
                    modal === 'deposit' ? 'bg-green-500 hover:bg-green-600' : 'bg-sheen-brown hover:bg-sheen-brown/90'
                  }`}
                >
                  {uploadingReceipt ? 'Uploading receipt…' : addMut.isPending ? 'Saving...' : modal === 'deposit' ? 'Add Deposit' : 'Add Withdrawal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} alt="Receipt" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}
    </div>
  )
}
