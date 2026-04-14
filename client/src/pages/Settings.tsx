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

interface BeanOption { name: string; premium: number }

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

  // Delivery scope: beans_only | all
  const { data: deliveryScopeData } = useQuery({
    queryKey: ['settings', 'delivery_scope'],
    queryFn: async () => {
      const { data } = await api.get('/api/settings/delivery_scope')
      return (data as string) ?? 'beans_only'
    },
  })
  const [deliveryScope, setDeliveryScope] = useState<'beans_only' | 'all'>('beans_only')
  useEffect(() => { if (deliveryScopeData) setDeliveryScope(deliveryScopeData as 'beans_only' | 'all') }, [deliveryScopeData])

  const deliveryScopeMut = useMutation({
    mutationFn: async (scope: string) => {
      await api.put('/api/settings/delivery_scope', { value: scope })
    },
    onSuccess: (_, scope) => {
      setDeliveryScope(scope as 'beans_only' | 'all')
      qc.invalidateQueries({ queryKey: ['settings', 'delivery_scope'] })
      toast.success(scope === 'all' ? 'Delivery enabled for all items' : 'Delivery enabled for beans only')
    },
    onError: () => toast.error('Failed to update'),
  })

  // Online ordering toggle
  const { data: orderingData } = useQuery({
    queryKey: ['settings', 'online_ordering_enabled'],
    queryFn: async () => {
      const { data } = await api.get('/api/settings/online_ordering_enabled')
      return data === true || data === null // enabled by default
    },
  })
  const [orderingEnabled, setOrderingEnabled] = useState(true)
  useEffect(() => { if (orderingData !== undefined) setOrderingEnabled(orderingData) }, [orderingData])

  const toggleOrderingMut = useMutation({
    mutationFn: async (enabled: boolean) => {
      await api.put('/api/settings/online_ordering_enabled', { value: enabled })
    },
    onSuccess: (_, enabled) => {
      setOrderingEnabled(enabled)
      qc.invalidateQueries({ queryKey: ['settings', 'online_ordering_enabled'] })
      toast.success(enabled ? 'Online ordering enabled' : 'Online ordering disabled')
    },
    onError: () => toast.error('Failed to update'),
  })

  // Bean options management
  const { data: beanData } = useQuery({
    queryKey: ['settings', 'bean_options'],
    queryFn: async () => {
      const { data } = await api.get('/api/settings/bean_options')
      return data as BeanOption[] | null
    },
  })
  const [beans, setBeans] = useState<BeanOption[]>([])
  const [newBeanName, setNewBeanName] = useState('')
  const [newBeanPremium, setNewBeanPremium] = useState('')
  useEffect(() => {
    if (beanData) setBeans(beanData)
  }, [beanData])

  const saveBeansMut = useMutation({
    mutationFn: async (updated: BeanOption[]) => {
      await api.put('/api/settings/bean_options', { value: updated })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'bean_options'] })
      toast.success('Beans updated')
    },
    onError: () => toast.error('Failed to save'),
  })

  // Extra shot price
  const { data: shotPriceData } = useQuery({
    queryKey: ['settings', 'extra_shot_price'],
    queryFn: async () => {
      const { data } = await api.get('/api/settings/extra_shot_price')
      return (data as number) ?? 5
    },
  })
  const [extraShotPrice, setExtraShotPrice] = useState<number>(5)
  useEffect(() => { if (shotPriceData !== undefined) setExtraShotPrice(Number(shotPriceData) || 5) }, [shotPriceData])

  const saveShotPriceMut = useMutation({
    mutationFn: async (price: number) => {
      await api.put('/api/settings/extra_shot_price', { value: price })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'extra_shot_price'] })
      toast.success('Extra shot price updated')
    },
    onError: () => toast.error('Failed to save'),
  })

  // Milk options management
  const { data: milkData } = useQuery({
    queryKey: ['settings', 'milk_options'],
    queryFn: async () => {
      const { data } = await api.get('/api/settings/milk_options')
      return data as BeanOption[] | null
    },
  })
  const [milks, setMilks] = useState<BeanOption[]>([])
  const [newMilkName, setNewMilkName] = useState('')
  const [newMilkPremium, setNewMilkPremium] = useState('')
  useEffect(() => {
    if (milkData) setMilks(milkData)
  }, [milkData])

  const saveMilksMut = useMutation({
    mutationFn: async (updated: BeanOption[]) => {
      await api.put('/api/settings/milk_options', { value: updated })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'milk_options'] })
      toast.success('Milks updated')
    },
    onError: () => toast.error('Failed to save'),
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
        {/* Online Ordering toggle */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg text-sheen-black">Online Ordering</h2>
              <p className="font-body text-xs text-sheen-muted mt-0.5">
                Enable or disable the order button for customers.
              </p>
            </div>
            <button
              onClick={() => toggleOrderingMut.mutate(!orderingEnabled)}
              disabled={toggleOrderingMut.isPending}
              className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                orderingEnabled ? 'bg-sheen-brown' : 'bg-sheen-muted/30'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ${
                  orderingEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-body ${orderingEnabled ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {orderingEnabled
              ? 'Ordering is ON — customers can place orders from the menu.'
              : 'Ordering is OFF — the order button is hidden for customers.'}
          </div>
        </div>

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

          {deliveryEnabled && (
            <div className="mt-4">
              <p className="font-body text-xs font-medium text-sheen-black mb-2">Delivery available for:</p>
              <div className="flex gap-2">
                {([
                  { value: 'beans_only', label: 'Beans only', desc: 'Drinks & food → Pickup only' },
                  { value: 'all', label: 'All items', desc: 'Any order can be delivered' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => deliveryScopeMut.mutate(opt.value)}
                    disabled={deliveryScopeMut.isPending}
                    className={`flex-1 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                      deliveryScope === opt.value
                        ? 'bg-sheen-brown text-white border-sheen-brown'
                        : 'bg-sheen-cream text-sheen-black border-sheen-muted/20 hover:border-sheen-brown/40'
                    }`}
                  >
                    <p className={`font-body text-xs font-semibold ${deliveryScope === opt.value ? 'text-white' : 'text-sheen-black'}`}>{opt.label}</p>
                    <p className={`font-body text-[10px] mt-0.5 ${deliveryScope === opt.value ? 'text-white/70' : 'text-sheen-muted'}`}>{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
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

        {/* Bean Options */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-5 mb-6">
          <h2 className="font-display text-lg text-sheen-black mb-1">Coffee Beans</h2>
          <p className="font-body text-xs text-sheen-muted mb-4">
            Manage the bean options customers and staff can choose from. Names must match your ingredients.
          </p>

          <div className="space-y-2 mb-4">
            {beans.map((bean, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-sheen-cream/50 rounded-lg px-4 py-3">
                <span className="font-body text-sm text-sheen-black font-medium flex-1">{bean.name}</span>
                {bean.premium > 0 && (
                  <span className="font-body text-xs text-sheen-gold font-medium">+{bean.premium} AED</span>
                )}
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={bean.premium}
                  onChange={(e) => {
                    const updated = beans.map((b, i) => i === idx ? { ...b, premium: Number(e.target.value) || 0 } : b)
                    setBeans(updated)
                    saveBeansMut.mutate(updated)
                  }}
                  placeholder="Premium"
                  className="w-20 px-2 py-1 rounded-lg border border-sheen-muted/30 font-body text-sm text-right focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                />
                <span className="font-body text-xs text-sheen-muted">AED</span>
                <button
                  onClick={() => {
                    const updated = beans.filter((_, i) => i !== idx)
                    setBeans(updated)
                    saveBeansMut.mutate(updated)
                  }}
                  className="text-red-400 hover:text-red-600 text-xs transition-colors"
                >
                  {t('delete')}
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newBeanName}
              onChange={e => setNewBeanName(e.target.value)}
              placeholder="Bean name (must match ingredient)"
              className="flex-1 px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
            />
            <input
              type="number"
              min="0"
              value={newBeanPremium}
              onChange={e => setNewBeanPremium(e.target.value)}
              placeholder="+AED"
              className="w-20 px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
            />
            <Button onClick={() => {
              if (!newBeanName.trim()) return
              const updated = [...beans, { name: newBeanName.trim(), premium: Number(newBeanPremium) || 0 }]
              setBeans(updated)
              saveBeansMut.mutate(updated)
              setNewBeanName('')
              setNewBeanPremium('')
            }} disabled={!newBeanName.trim()}>
              {t('add')}
            </Button>
          </div>
        </div>

        {/* Extra Shot Price */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-5 mb-6">
          <h2 className="font-display text-lg text-sheen-black mb-1">Extra Shot Price</h2>
          <p className="font-body text-xs text-sheen-muted mb-4">
            Price added per extra espresso shot. Shown as an add-on on coffee items.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              step="0.5"
              value={extraShotPrice}
              onChange={(e) => setExtraShotPrice(Number(e.target.value) || 0)}
              onBlur={() => saveShotPriceMut.mutate(extraShotPrice)}
              className="w-32 px-3 py-2 rounded-lg border border-sheen-muted/30 bg-sheen-cream font-body text-sm text-right focus:outline-none focus:ring-1 focus:ring-sheen-gold"
            />
            <span className="font-body text-sm text-sheen-muted">AED per shot</span>
          </div>
        </div>

        {/* Milk Options */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-5 mb-6">
          <h2 className="font-display text-lg text-sheen-black mb-1">Milk Options</h2>
          <p className="font-body text-xs text-sheen-muted mb-4">
            Manage the milk options. Names must match your Dairy ingredients.
          </p>

          <div className="space-y-2 mb-4">
            {milks.map((milk, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-sheen-cream/50 rounded-lg px-4 py-3">
                <span className="font-body text-sm text-sheen-black font-medium flex-1">{milk.name}</span>
                {milk.premium > 0 && (
                  <span className="font-body text-xs text-sheen-gold font-medium">+{milk.premium} AED</span>
                )}
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={milk.premium}
                  onChange={(e) => {
                    const updated = milks.map((m, i) => i === idx ? { ...m, premium: Number(e.target.value) || 0 } : m)
                    setMilks(updated)
                    saveMilksMut.mutate(updated)
                  }}
                  placeholder="Premium"
                  className="w-20 px-2 py-1 rounded-lg border border-sheen-muted/30 font-body text-sm text-right focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                />
                <span className="font-body text-xs text-sheen-muted">AED</span>
                <button
                  onClick={() => {
                    const updated = milks.filter((_, i) => i !== idx)
                    setMilks(updated)
                    saveMilksMut.mutate(updated)
                  }}
                  className="text-red-400 hover:text-red-600 text-xs transition-colors"
                >
                  {t('delete')}
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newMilkName}
              onChange={e => setNewMilkName(e.target.value)}
              placeholder="Milk name (must match ingredient)"
              className="flex-1 px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
            />
            <input
              type="number"
              min="0"
              value={newMilkPremium}
              onChange={e => setNewMilkPremium(e.target.value)}
              placeholder="+AED"
              className="w-20 px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
            />
            <Button onClick={() => {
              if (!newMilkName.trim()) return
              const updated = [...milks, { name: newMilkName.trim(), premium: Number(newMilkPremium) || 0 }]
              setMilks(updated)
              saveMilksMut.mutate(updated)
              setNewMilkName('')
              setNewMilkPremium('')
            }} disabled={!newMilkName.trim()}>
              {t('add')}
            </Button>
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
