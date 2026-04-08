import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import TopBar from '../components/layout/TopBar'
import Button from '../components/ui/Button'
import { useLanguage } from '../i18n/LanguageContext'
import toast from 'react-hot-toast'

interface OrderSource {
  id: string
  commission: number
  vat: boolean  // apply 5% VAT on commission
}

export default function Settings() {
  const { t } = useLanguage()
  const qc = useQueryClient()
  const [sources, setSources] = useState<OrderSource[]>([])
  const [newName, setNewName] = useState('')
  const [newCommission, setNewCommission] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'order_sources'],
    queryFn: async () => {
      const { data } = await api.get('/api/settings/order_sources')
      return data as OrderSource[] | null
    },
  })

  useEffect(() => {
    if (data) setSources(data)
  }, [data])

  const saveMut = useMutation({
    mutationFn: async (updated: OrderSource[]) => {
      await api.put('/api/settings/order_sources', { value: updated })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'order_sources'] })
      toast.success(t('save'))
    },
    onError: () => toast.error('Failed to save'),
  })

  const updateCommission = (id: string, commission: number) => {
    const updated = sources.map(s => s.id === id ? { ...s, commission } : s)
    setSources(updated)
    saveMut.mutate(updated)
  }

  const addSource = () => {
    if (!newName.trim()) return
    const updated = [...sources, { id: newName.trim(), commission: Number(newCommission) || 0, vat: false }]
    setSources(updated)
    saveMut.mutate(updated)
    setNewName('')
    setNewCommission('')
  }

  const removeSource = (id: string) => {
    const updated = sources.filter(s => s.id !== id)
    setSources(updated)
    saveMut.mutate(updated)
  }

  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title={t('settings')} />

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Order Sources / Commissions */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-5 mb-6">
          <h2 className="font-display text-lg text-sheen-black mb-1">{t('orderSources')}</h2>
          <p className="font-body text-xs text-sheen-muted mb-4">{t('orderSourcesDesc')}</p>

          {isLoading ? (
            <p className="font-body text-sm text-sheen-muted">{t('loading')}</p>
          ) : (
            <div className="space-y-2">
              {sources.map((src) => (
                <div key={src.id} className="flex items-center gap-3 bg-sheen-cream/50 rounded-lg px-4 py-3 flex-wrap">
                  <span className="font-body text-sm text-sheen-black font-medium flex-1 min-w-[80px]">{src.id}</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={src.commission}
                      onChange={(e) => updateCommission(src.id, Number(e.target.value))}
                      className="w-20 px-2 py-1 rounded-lg border border-sheen-muted/30 font-body text-sm text-right focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                    />
                    <span className="font-body text-xs text-sheen-muted">%</span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={src.vat ?? false}
                      onChange={(e) => {
                        const updated = sources.map(s => s.id === src.id ? { ...s, vat: e.target.checked } : s)
                        setSources(updated)
                        saveMut.mutate(updated)
                      }}
                      className="h-4 w-4 accent-sheen-gold cursor-pointer"
                    />
                    <span className="font-body text-xs text-sheen-muted">VAT 5%</span>
                  </label>
                  <button
                    onClick={() => removeSource(src.id)}
                    className="text-red-400 hover:text-red-600 text-xs transition-colors"
                  >
                    {t('delete')}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new source */}
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder={t('sourceName')}
              className="flex-1 px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
            />
            <input
              type="number"
              min="0"
              step="0.1"
              value={newCommission}
              onChange={e => setNewCommission(e.target.value)}
              placeholder="%"
              className="w-20 px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
            />
            <Button onClick={addSource} disabled={!newName.trim()}>
              {t('add')}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
