import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import TopBar from '../components/layout/TopBar'
import Button from '../components/ui/Button'
import { useLanguage } from '../i18n/LanguageContext'
import { getDefaultPaymentMethods, updateDefaultPaymentMethods } from '../services/userService'
import toast from 'react-hot-toast'

const ALL_PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card' },
]

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
  const [categories, setCategories] = useState<string[]>([])
  const [newCategory, setNewCategory] = useState('')

  // Delivery toggle
  const { data: deliveryData } = useQuery({
    queryKey: ['settings', 'delivery_enabled'],
    queryFn: async () => {
      const { data } = await api.get('/api/settings/delivery_enabled')
      return (data === true) as boolean
    },
  })
  const [deliveryEnabled, setDeliveryEnabled] = useState(false)
  useEffect(() => { if (deliveryData !== undefined) setDeliveryEnabled(deliveryData ?? false) }, [deliveryData])

  const toggleDeliveryMut = useMutation({
    mutationFn: async (enabled: boolean) => {
      await api.put('/api/settings/delivery_enabled', { value: enabled })
    },
    onSuccess: (_, enabled) => {
      setDeliveryEnabled(enabled)
      qc.invalidateQueries({ queryKey: ['settings', 'delivery_enabled'] })
      toast.success(enabled ? 'Delivery enabled' : 'Delivery disabled')
    },
    onError: () => toast.error('Failed to update'),
  })

  // Default payment methods
  const { data: defaultMethods } = useQuery({
    queryKey: ['default-payment-methods'],
    queryFn: getDefaultPaymentMethods,
  })
  const paymentMut = useMutation({
    mutationFn: (methods: string[]) => updateDefaultPaymentMethods(methods),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['default-payment-methods'] }),
    onError: () => toast.error('Failed to update payment methods'),
  })
  const toggleDefaultMethod = (methodId: string) => {
    const current = defaultMethods ?? ALL_PAYMENT_METHODS.map(m => m.id)
    const updated = current.includes(methodId) ? current.filter(m => m !== methodId) : [...current, methodId]
    paymentMut.mutate(updated)
  }

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

  const defaultCategories = ['Coffee', 'Dairy', 'Matcha', 'Packaging', 'Fruit', 'Syrup', 'Baking', 'Transportation', 'Other']

  const { data: catData } = useQuery({
    queryKey: ['settings', 'expense_categories'],
    queryFn: async () => {
      const { data } = await api.get('/api/settings/expense_categories')
      return data as string[] | null
    },
  })

  useEffect(() => {
    setCategories(catData ?? defaultCategories)
  }, [catData])

  const saveCatMut = useMutation({
    mutationFn: async (updated: string[]) => {
      await api.put('/api/settings/expense_categories', { value: updated })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'expense_categories'] })
      toast.success(t('save'))
    },
    onError: () => toast.error('Failed to save'),
  })

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
        {/* Delivery toggle */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg text-sheen-black">Delivery</h2>
              <p className="font-body text-xs text-sheen-muted mt-0.5">
                Allow customers to choose delivery when placing an order.
              </p>
            </div>
            <button
              onClick={() => toggleDeliveryMut.mutate(!deliveryEnabled)}
              disabled={toggleDeliveryMut.isPending}
              className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                deliveryEnabled ? 'bg-sheen-brown' : 'bg-sheen-muted/30'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ${
                  deliveryEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-body ${deliveryEnabled ? 'bg-green-50 text-green-700' : 'bg-sheen-cream text-sheen-muted'}`}>
            {deliveryEnabled
              ? 'Delivery is ON — customers will see a Pickup / Delivery choice when ordering.'
              : 'Delivery is OFF — customers can only choose Pickup.'}
          </div>
        </div>

        {/* Default Payment Methods */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-5 mb-6">
          <h2 className="font-display text-lg text-sheen-black mb-1">Payment Methods</h2>
          <p className="font-body text-xs text-sheen-muted mb-4">
            Choose which payment methods customers can use when ordering.
          </p>
          <div className="flex gap-3">
            {ALL_PAYMENT_METHODS.map((method) => {
              const current = defaultMethods ?? ALL_PAYMENT_METHODS.map(m => m.id)
              const enabled = current.includes(method.id)
              return (
                <label
                  key={method.id}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl cursor-pointer transition-colors flex-1 border ${
                    enabled ? 'bg-sheen-gold/10 border-sheen-gold/40' : 'bg-sheen-cream border-sheen-muted/20'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => toggleDefaultMethod(method.id)}
                    className="h-4 w-4 accent-sheen-gold cursor-pointer"
                  />
                  <span className={`font-body text-sm font-medium ${enabled ? 'text-sheen-black' : 'text-sheen-muted'}`}>
                    {method.label}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

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
        {/* Expense Categories */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-5 mb-6">
          <h2 className="font-display text-lg text-sheen-black mb-1">{t('expenseCategories')}</h2>
          <p className="font-body text-xs text-sheen-muted mb-4">{t('expenseCategoriesDesc')}</p>

          <div className="flex flex-wrap gap-2 mb-4">
            {categories.map((cat) => (
              <div key={cat} className="flex items-center gap-1.5 bg-sheen-cream/50 rounded-lg px-3 py-2">
                <span className="font-body text-sm text-sheen-black">{cat}</span>
                <button
                  onClick={() => {
                    const updated = categories.filter(c => c !== cat)
                    setCategories(updated)
                    saveCatMut.mutate(updated)
                  }}
                  className="text-red-400 hover:text-red-600 text-xs transition-colors ml-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newCategory.trim()) {
                  const updated = [...categories, newCategory.trim()]
                  setCategories(updated)
                  saveCatMut.mutate(updated)
                  setNewCategory('')
                }
              }}
              placeholder={t('newCategory')}
              className="flex-1 px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
            />
            <Button onClick={() => {
              if (!newCategory.trim()) return
              const updated = [...categories, newCategory.trim()]
              setCategories(updated)
              saveCatMut.mutate(updated)
              setNewCategory('')
            }} disabled={!newCategory.trim()}>
              {t('add')}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
