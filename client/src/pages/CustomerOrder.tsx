import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMenuItems } from '../hooks/useFixedCosts'
import api from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'
import { getDefaultPaymentMethods } from '../services/userService'
import { createOrder } from '../services/orderService'
import { createPaymentIntent } from '../services/paymentService'
import { getItemImage } from '../data/itemImages'
import TopBar from '../components/layout/TopBar'
import Button from '../components/ui/Button'
import StripeCheckout from '../components/StripeCheckout'
import { useLanguage } from '../i18n/LanguageContext'
import toast from 'react-hot-toast'
import type { MenuItem, MenuCategory } from '../types'

const CATEGORIES: MenuCategory[] = ['Coffee', 'Matcha', 'Cold Drinks', 'Açaí', 'Desserts', 'Bites', 'Beans']
const PAYMENT_METHODS = ['cash', 'card'] as const
type PaymentMethod = typeof PAYMENT_METHODS[number]

export default function CustomerOrder() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const { allowedPaymentMethods, plateNumber, phone, fullName, homeAddress, roleLoading } = useRole()

  // Profile completion state
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [profilePlate, setProfilePlate] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileDone, setProfileDone] = useState(false) // prevents re-triggering after save

  // Show profile modal only once when role loads and plate is missing
  useEffect(() => {
    if (!roleLoading && user && !plateNumber && !profileDone) {
      setProfileName(fullName || user.user_metadata?.full_name || user.user_metadata?.name || '')
      setProfilePhone(phone || '')
      setShowProfileModal(true)
    }
  }, [roleLoading]) // only run once when loading finishes

  const handleSaveProfile = async () => {
    if (!profilePlate.trim() || !user) return
    setProfileSaving(true)
    try {
      await api.patch(`/api/users/profile/${user.id}`, {
        full_name: profileName.trim() || undefined,
        phone: profilePhone.trim() || undefined,
        plate_number: profilePlate.trim(),
      })
      setProfileDone(true)
      setShowProfileModal(false)
    } catch {
      toast.error('Failed to save profile')
    }
    setProfileSaving(false)
  }
  const queryClient = useQueryClient()

  // Fetch online ordering setting
  const { data: orderingEnabled = true } = useQuery({
    queryKey: ['settings', 'online_ordering_enabled'],
    queryFn: async () => {
      const { data } = await api.get('/api/settings/online_ordering_enabled')
      return data === true || data === null // enabled by default
    },
  })

  // Fetch delivery enabled + scope settings
  const { data: deliveryEnabled = false } = useQuery({
    queryKey: ['settings', 'delivery_enabled'],
    queryFn: async () => {
      const { data } = await api.get('/api/settings/delivery_enabled')
      return data === true
    },
  })
  const { data: deliveryScope = 'beans_only' } = useQuery({
    queryKey: ['settings', 'delivery_scope'],
    queryFn: async () => {
      const { data } = await api.get('/api/settings/delivery_scope')
      return (data as string) ?? 'beans_only'
    },
  })
  const [orderType, setOrderType] = useState<'pickup' | 'delivery'>('pickup')

  // Fetch default payment methods (for any customer)
  const { data: defaultPaymentMethods } = useQuery({
    queryKey: ['default-payment-methods'],
    queryFn: getDefaultPaymentMethods,
  })

  // User-specific methods take priority, then default, then all
  const effectivePaymentMethods = allowedPaymentMethods && allowedPaymentMethods.length > 0
    ? allowedPaymentMethods
    : defaultPaymentMethods && defaultPaymentMethods.length > 0
      ? defaultPaymentMethods
      : null
  const { data: menuItems = [], isLoading: menuLoading } = useMenuItems()
  const [activeCategory, setActiveCategory] = useState<MenuCategory>('Coffee')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [showCart, setShowCart] = useState(false)
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null)
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)
  const [beanChoices, setBeanChoices] = useState<Record<string, string>>({}) // itemId → bean name

  // Load pending order saved by PublicMenu before login (one-shot)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('sheen-pending-order')
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed?.quantities && Object.keys(parsed.quantities).length > 0) {
        setQuantities(parsed.quantities)
        if (parsed.beanChoices) setBeanChoices(parsed.beanChoices)
        toast.success('Your selected items are in the cart')
      }
      localStorage.removeItem('sheen-pending-order')
    } catch {
      // ignore
    }
  }, [])

  const { data: beanOptions = [] } = useQuery({
    queryKey: ['settings', 'bean_options'],
    queryFn: async () => {
      const { data } = await api.get('/api/settings/bean_options')
      return (data as Array<{ name: string; premium: number }>) ?? []
    },
  })
  const getBeanPremium = (beanName: string) => beanOptions.find(b => b.name === beanName)?.premium ?? 0
  const [stripeLoading, setStripeLoading] = useState(false)

  // Refs
  const tabsRef = useRef<HTMLDivElement>(null)

  // Auto-scroll active tab into view
  useEffect(() => {
    if (!tabsRef.current) return
    const activeBtn = tabsRef.current.querySelector('[data-active="true"]') as HTMLElement | null
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [activeCategory])

  // Swipe logic with slide animation
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const isSwiping = useRef(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isSwiping.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = Math.abs(e.touches[0].clientX - touchStartX.current)
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current)
    if (dx > dy && dx > 8) isSwiping.current = true
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isSwiping.current) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) < 30) return
    const idx = CATEGORIES.indexOf(activeCategory)
    if (dx < 0 && idx < CATEGORIES.length - 1) {
      setSlideDir('left')
      setTimeout(() => { setActiveCategory(CATEGORIES[idx + 1]); setSlideDir(null) }, 150)
    } else if (dx > 0 && idx > 0) {
      setSlideDir('right')
      setTimeout(() => { setActiveCategory(CATEGORIES[idx - 1]); setSlideDir(null) }, 150)
    }
  }

  const activeItems = useMemo(
    () => menuItems.filter((item: MenuItem) => item.category === activeCategory && item.is_active),
    [menuItems, activeCategory],
  )

  const getQty = useCallback((id: string) => quantities[id] ?? 0, [quantities])

  const increment = useCallback((id: string) =>
    setQuantities((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 })), [])

  const decrement = useCallback((id: string) =>
    setQuantities((prev) => {
      const cur = prev[id] ?? 0
      if (cur <= 1) { const next = { ...prev }; delete next[id]; return next }
      return { ...prev, [id]: cur - 1 }
    }), [])

  const cartItems = useMemo(() => {
    return Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const item = menuItems.find((m: MenuItem) => m.id === id)
        if (!item) return null
        // Colombia premium: +5 AED per coffee
        const cartBeanPremium = item.category === 'Coffee' ? getBeanPremium(beanChoices[item.id] || beanOptions[0]?.name || '') : 0
        const effectivePrice = item.selling_price + cartBeanPremium
        return { ...item, selling_price: effectivePrice, qty, total: effectivePrice * qty }
      })
      .filter(Boolean) as (MenuItem & { qty: number; total: number })[]
  }, [quantities, menuItems, beanChoices])

  const cartTotal = cartItems.reduce((s, i) => s + i.total, 0)

  // Delivery available when admin enabled it and there are items
  const deliveryOn = deliveryEnabled && cartItems.length > 0

  // Items that qualify for delivery
  const deliverableItems = deliveryScope === 'all'
    ? cartItems
    : cartItems.filter(i => i.category === 'Beans')

  // Items that will be dropped if delivery is chosen (beans_only scope)
  const nonDeliverableItems = deliveryScope === 'beans_only'
    ? cartItems.filter(i => i.category !== 'Beans')
    : []

  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0)

  const placeOrder = async (paymentNote: string) => {
    // When delivery selected with beans_only scope, submit only deliverable items
    const itemsToSubmit = (orderType === 'delivery' && deliveryScope === 'beans_only')
      ? deliverableItems
      : cartItems

    if (itemsToSubmit.length === 0) {
      toast.error('No items to submit.')
      return
    }

    await createOrder({
      customer_id: user!.id,
      customer_email: user!.email,
      customer_name: user!.user_metadata?.full_name || user!.user_metadata?.name || user!.email?.split('@')[0] || user!.email,
      items: itemsToSubmit.map((i) => ({
        menu_item_id: i.id,
        name: i.category === 'Coffee' ? `${i.name} (${beanChoices[i.id] || beanOptions[0]?.name || 'Ethiopia'})` : i.name,
        price: i.selling_price,
        qty: i.qty,
      })),
      notes: [
        plateNumber ? `Plate: ${plateNumber}` : null,
        deliveryOn ? (orderType === 'delivery' ? `[Delivery]${homeAddress ? ` → ${homeAddress}` : ' (no address saved)'}` : '[Pickup]') : null,
        notes || null,
        paymentNote,
      ].filter(Boolean).join('\n'),
    })
    toast.success(t('orderSubmitted'))
    setQuantities({})
    setNotes('')
    setPaymentMethod('cash')
    setShowCart(false)
    setStripeClientSecret(null)
    queryClient.invalidateQueries({ queryKey: ['orders'] })
  }

  const submitOrder = useMutation({
    mutationFn: () => placeOrder(`[Payment: ${t(paymentMethod as any)}]`),
    onError: () => toast.error(t('orderFailed')),
  })

  // Start Stripe checkout for card payments (Apple Pay/Google Pay included)
  const handleCardPayment = async () => {
    setStripeLoading(true)
    try {
      const { clientSecret } = await createPaymentIntent(cartTotal, user?.email ?? undefined)
      setStripeClientSecret(clientSecret)
    } catch {
      toast.error('Failed to start payment')
    } finally {
      setStripeLoading(false)
    }
  }

  // Called when Stripe payment succeeds
  const handlePaymentSuccess = async (paymentIntentId: string) => {
    try {
      await placeOrder(`[Payment: Card/Wallet - Stripe: ${paymentIntentId}]`)
    } catch {
      toast.error(t('orderFailed'))
    }
  }


  const paymentIcons: Record<PaymentMethod, React.ReactNode> = {
    cash: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="3" />
        <path d="M2 10H6" /><path d="M18 10H22" />
      </svg>
    ),
    card: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10H22" />
        <path d="M6 14H10" />
      </svg>
    ),
  }

  // Show profile form as a full page (not a modal) to avoid iOS keyboard/fixed-position issues
  if (showProfileModal) {
    return (
      <div className="min-h-screen bg-sheen-cream">
        <TopBar title="Complete Profile" />
        <div className="max-w-sm mx-auto px-4 py-8">
          <h3 className="font-display text-xl font-bold text-sheen-black mb-1">Complete Your Profile</h3>
          <p className="font-body text-sm text-sheen-muted mb-6">We need a few details to serve you at our drive-through.</p>

          <div className="space-y-4">
            <div>
              <label className="block font-body text-xs text-sheen-muted mb-1">Full Name</label>
              <input
                type="text"
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-3 rounded-lg border border-sheen-muted/30 font-body text-base focus:outline-none focus:ring-1 focus:ring-sheen-gold"
              />
            </div>
            <div>
              <label className="block font-body text-xs text-sheen-muted mb-1">Phone Number</label>
              <input
                type="tel"
                value={profilePhone}
                onChange={e => setProfilePhone(e.target.value)}
                placeholder="e.g. 0501234567"
                className="w-full px-3 py-3 rounded-lg border border-sheen-muted/30 font-body text-base focus:outline-none focus:ring-1 focus:ring-sheen-gold"
              />
            </div>
            <div>
              <label className="block font-body text-xs text-sheen-muted mb-1">UAE Plate Number <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={profilePlate}
                onChange={e => setProfilePlate(e.target.value.toUpperCase())}
                placeholder="e.g. A 12345"
                className="w-full px-3 py-3 rounded-lg border border-sheen-gold font-body text-base focus:outline-none focus:ring-2 focus:ring-sheen-gold uppercase tracking-widest"
              />
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={!profilePlate.trim() || profileSaving}
              className="w-full py-3 rounded-xl bg-sheen-brown text-white font-body font-semibold text-sm hover:bg-sheen-brown/90 transition-colors disabled:opacity-50"
            >
              {profileSaving ? 'Saving...' : 'Save & Continue'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-sheen-cream overflow-x-hidden">
      <TopBar title={t('orderNow')} />

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Category Tabs */}
        <div ref={tabsRef} className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none no-scrollbar snap-x snap-mandatory" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              data-active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-body font-medium transition-colors snap-start ${
                activeCategory === cat
                  ? 'bg-sheen-brown text-sheen-white shadow-md'
                  : 'bg-sheen-white text-sheen-black border border-sheen-muted/30'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Menu Items Grid (swipeable) */}
        <div
          ref={gridRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`grid ${activeCategory === 'Beans' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'} gap-4 mb-6 transition-all duration-150 ${
            slideDir === 'left' ? 'opacity-0 -translate-x-8' :
            slideDir === 'right' ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0'
          }`}
        >
          {menuLoading ? (
            <p className="col-span-full text-center text-sheen-muted font-body py-12">{t('loadingMenu')}</p>
          ) : activeItems.length === 0 ? (
            <p className="col-span-full text-center text-sheen-muted font-body py-12">{t('noItemsInCategory')}</p>
          ) : (
            activeItems.map((item: MenuItem) => {
              const qty = getQty(item.id)
              return (
                <div key={item.id} className={`bg-sheen-white rounded-xl shadow-sm overflow-hidden ${activeCategory === 'Beans' ? 'group hover:shadow-lg' : ''}`}>
                  {getItemImage(item.name, item.image_url) ? (
                    <div
                      className={`overflow-hidden ${activeCategory === 'Beans' ? 'h-56 cursor-pointer' : 'h-32'}`}
                      onClick={() => activeCategory === 'Beans' && setLightboxImg(getItemImage(item.name, item.image_url) || null)}
                    >
                      <img src={getItemImage(item.name, item.image_url)} alt={item.name} className={`w-full h-full object-cover transition-transform duration-300 ${activeCategory === 'Beans' ? 'group-hover:scale-110' : ''}`} />
                    </div>
                  ) : (
                    <div className={`w-full ${activeCategory === 'Beans' ? 'h-56 bg-sheen-black' : 'h-32 bg-sheen-cream'} flex items-center justify-center text-3xl`}>☕</div>
                  )}
                  <div className={activeCategory === 'Beans' ? 'p-4' : 'p-3'}>
                    <h3 className={`font-body font-medium text-sheen-black leading-tight ${activeCategory === 'Beans' ? 'text-base' : 'text-sm'}`}>{item.name}</h3>
                    {activeCategory === 'Beans' && item.description && (
                      <div className="mt-2 space-y-1.5">
                        {(() => {
                          const parts = item.description.split(' | ')
                          const roastType = parts[0] || ''
                          const tastingLine = parts.find(p => p.startsWith('Tasting Notes:'))
                          const tastingNotes = tastingLine ? tastingLine.replace('Tasting Notes: ', '').split(', ') : []
                          return (
                            <>
                              <p className="font-body text-[10px] text-sheen-gold uppercase tracking-wider font-medium">{roastType}</p>
                              {tastingNotes.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {tastingNotes.map(note => (
                                    <span key={note} className="px-1.5 py-0.5 rounded-full bg-sheen-cream text-sheen-brown text-[9px] font-body font-medium">
                                      {note}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    )}
                    {/* Bean selector for coffee */}
                    {item.category === 'Coffee' && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {beanOptions.map(bean => (
                          <button
                            key={bean.name}
                            onClick={(e) => { e.stopPropagation(); setBeanChoices(prev => ({ ...prev, [item.id]: bean.name })) }}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-body font-medium transition-colors ${
                              (beanChoices[item.id] || beanOptions[0]?.name) === bean.name
                                ? 'bg-sheen-brown text-white'
                                : 'bg-sheen-cream text-sheen-muted'
                            }`}
                          >
                            {bean.name}{bean.premium > 0 ? ` +${bean.premium}` : ''}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className={`font-display font-semibold text-sheen-brown mt-1 ${activeCategory === 'Beans' ? 'text-lg' : 'text-base'}`}>
                      {item.category === 'Coffee'
                        ? item.selling_price + getBeanPremium(beanChoices[item.id] || beanOptions[0]?.name || '')
                        : item.selling_price} AED
                    </p>
                    {orderingEnabled && (
                      <div className="flex items-center gap-1 mt-2">
                        {qty > 0 ? (
                          <>
                            <button onClick={() => decrement(item.id)} className="w-8 h-8 flex items-center justify-center rounded-md bg-sheen-cream text-sheen-black font-bold text-lg">&minus;</button>
                            <span className="w-8 text-center font-body text-sm font-medium">{qty}</span>
                            <button onClick={() => increment(item.id)} className="w-8 h-8 flex items-center justify-center rounded-md bg-sheen-brown text-white font-bold text-lg">+</button>
                          </>
                        ) : (
                          <button onClick={() => increment(item.id)} className="w-full py-1.5 rounded-md bg-sheen-brown text-white text-xs font-body font-medium">{t('addToCart')}</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Image Lightbox */}
        {lightboxImg && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
            <img src={lightboxImg} alt="" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
          </div>
        )}

        {/* Ordering disabled banner */}
        {!orderingEnabled && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-center">
            <p className="font-body text-sm text-red-700 font-medium">Ordering is currently closed. Please check back later.</p>
          </div>
        )}

        {/* Floating Cart Button */}
        {orderingEnabled && cartCount > 0 && !showCart && (
          <button
            onClick={() => setShowCart(true)}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 bg-sheen-brown text-white px-6 py-3 rounded-full shadow-lg font-body font-semibold flex items-center gap-3"
          >
            <span className="bg-white text-sheen-brown w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">{cartCount}</span>
            {t('viewCart')} — {cartTotal.toFixed(2)} AED
          </button>
        )}

        {/* Cart Panel */}
        {showCart && (
          <div className="fixed inset-0 z-30 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCart(false)}>
            <div className="bg-sheen-white w-full max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-sheen-white border-b border-sheen-cream px-5 py-4 flex items-center justify-between">
                <h2 className="font-display text-lg text-sheen-black">{t('yourOrder')}</h2>
                <button onClick={() => setShowCart(false)} className="text-sheen-muted hover:text-sheen-black text-xl">&times;</button>
              </div>

              <div className="p-5 space-y-3">
                {/* Cart Items */}
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm text-sheen-black">
                        {item.name}
                        {item.category === 'Coffee' && beanChoices[item.id] && (
                          <span className="ml-1 text-[10px] text-sheen-gold">({beanChoices[item.id]})</span>
                        )}
                      </p>
                      <p className="font-body text-xs text-sheen-muted">{item.selling_price} AED x {item.qty}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-body text-sm font-semibold text-sheen-brown">{item.total.toFixed(2)} AED</span>
                      <button onClick={() => { const next = { ...quantities }; delete next[item.id]; setQuantities(next) }} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </div>
                  </div>
                ))}

                {/* Pickup / Delivery selector */}
                {deliveryOn && (
                  <div className="pt-3 border-t border-sheen-cream">
                    <p className="font-body text-sm font-medium text-sheen-black mb-2">Order Type</p>
                    <div className="flex gap-2">
                      {(['pickup', 'delivery'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setOrderType(type)}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-body font-medium transition-all flex-1 justify-center ${
                            orderType === type
                              ? 'bg-sheen-brown text-white shadow-md'
                              : 'bg-sheen-cream text-sheen-black border border-sheen-muted/20'
                          }`}
                        >
                          {type === 'pickup' ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z"/></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/></svg>
                          )}
                          {type === 'pickup' ? 'Pickup' : 'Delivery'}
                        </button>
                      ))}
                    </div>

                    {/* Delivery address */}
                    {orderType === 'delivery' && (
                      <div className="mt-2 px-3 py-2 rounded-lg bg-sheen-cream text-xs font-body text-sheen-black">
                        {homeAddress
                          ? <><span className="text-sheen-gold mr-1">📍</span>{homeAddress}</>
                          : <span className="text-sheen-muted">No home address saved — go to <strong>My Profile</strong> to add one.</span>
                        }
                      </div>
                    )}

                    {/* Warning: drinks will be dropped from delivery order */}
                    {orderType === 'delivery' && nonDeliverableItems.length > 0 && (
                      <div className="mt-2 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-orange-50 border border-orange-200">
                        <span className="text-sm shrink-0">⚠️</span>
                        <p className="font-body text-xs text-orange-700 leading-snug">
                          <strong>Delivery is beans only.</strong> The following will be removed from this order:{' '}
                          {nonDeliverableItems.map(i => `${i.name} ×${i.qty}`).join(', ')}.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Payment Method */}
                <div className="pt-3 border-t border-sheen-cream">
                  <p className="font-body text-sm font-medium text-sheen-black mb-2">{t('paymentMethod')}</p>
                  <div className="flex gap-2">
                    {PAYMENT_METHODS.filter((m) =>
                      !effectivePaymentMethods || effectivePaymentMethods.includes(m)
                    ).map((method) => (
                      <button
                        key={method}
                        onClick={() => setPaymentMethod(method)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-body font-medium transition-all ${
                          paymentMethod === method
                            ? 'bg-sheen-brown text-white shadow-md'
                            : 'bg-sheen-cream text-sheen-black border border-sheen-muted/20'
                        }`}
                      >
                        {paymentIcons[method]}
                        {t(method as any)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="pt-3">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('orderNotes')}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm resize-none focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                  />
                </div>

                {/* Total + Submit */}
                <div className="border-t border-sheen-cream pt-4">
                  <div className="flex justify-between mb-1">
                    <span className="font-body font-semibold text-sheen-black">{t('total')}</span>
                    <span className="font-display text-xl font-bold text-sheen-brown">{cartTotal.toFixed(2)} AED</span>
                  </div>
                  <p className="font-body text-[10px] text-sheen-muted text-right mb-3">{t('allPricesInAED' as any)}</p>

                  {/* Stripe checkout form for card payments */}
                  {stripeClientSecret && paymentMethod === 'card' ? (
                    <StripeCheckout
                      clientSecret={stripeClientSecret}
                      amount={cartTotal}
                      onSuccess={handlePaymentSuccess}
                      onCancel={() => setStripeClientSecret(null)}
                    />
                  ) : paymentMethod === 'card' ? (
                    <Button
                      onClick={handleCardPayment}
                      disabled={stripeLoading}
                      className="w-full"
                    >
                      {stripeLoading ? t('processing') : t('proceedToPayment')}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => submitOrder.mutate()}
                      disabled={submitOrder.isPending}
                      className="w-full"
                    >
                      {submitOrder.isPending ? t('submitting') : t('submitOrder')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

    </div>
  )
}
