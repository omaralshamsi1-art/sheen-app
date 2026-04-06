import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMenuItems } from '../hooks/useFixedCosts'
import { useAuth } from '../hooks/useAuth'
import { createOrder, getOrders } from '../services/orderService'
import { getItemImage } from '../data/itemImages'
import TopBar from '../components/layout/TopBar'
import Button from '../components/ui/Button'
import { useLanguage } from '../i18n/LanguageContext'
import toast from 'react-hot-toast'
import type { MenuItem, MenuCategory, Order, OrderItem } from '../types'
import { format } from 'date-fns'

const CATEGORIES: MenuCategory[] = ['Coffee', 'Matcha', 'Cold Drinks', 'Açaí', 'Desserts', 'Bites']

export default function CustomerOrder() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: menuItems = [], isLoading: menuLoading } = useMenuItems()
  const [activeCategory, setActiveCategory] = useState<MenuCategory>('Coffee')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')
  const [showCart, setShowCart] = useState(false)

  // Fetch customer's orders
  const { data: myOrders = [] } = useQuery({
    queryKey: ['orders', 'mine', user?.id],
    queryFn: () => getOrders({ customer_id: user?.id }),
    enabled: !!user?.id,
  })

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

  // Cart items
  const cartItems = useMemo(() => {
    return Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const item = menuItems.find((m: MenuItem) => m.id === id)
        return item ? { ...item, qty, total: item.selling_price * qty } : null
      })
      .filter(Boolean) as (MenuItem & { qty: number; total: number })[]
  }, [quantities, menuItems])

  const cartTotal = cartItems.reduce((s, i) => s + i.total, 0)
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0)

  // Submit order
  const submitOrder = useMutation({
    mutationFn: () => createOrder({
      customer_id: user!.id,
      customer_email: user!.email,
      customer_name: user!.user_metadata?.full_name || user!.email,
      items: cartItems.map((i) => ({
        menu_item_id: i.id,
        name: i.name,
        price: i.selling_price,
        qty: i.qty,
      })),
      notes: notes || undefined,
    }),
    onSuccess: () => {
      toast.success(t('orderSubmitted'))
      setQuantities({})
      setNotes('')
      setShowCart(false)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: () => toast.error(t('orderFailed')),
  })

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    completed: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title={t('orderNow')} />

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Category Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none no-scrollbar" style={{ scrollbarWidth: 'none' }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-body font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-sheen-brown text-sheen-white shadow-md'
                  : 'bg-sheen-white text-sheen-black border border-sheen-muted/30'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Menu Items Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
          {menuLoading ? (
            <p className="col-span-full text-center text-sheen-muted font-body py-12">{t('loadingMenu')}</p>
          ) : activeItems.length === 0 ? (
            <p className="col-span-full text-center text-sheen-muted font-body py-12">{t('noItemsInCategory')}</p>
          ) : (
            activeItems.map((item: MenuItem) => {
              const qty = getQty(item.id)
              return (
                <div key={item.id} className="bg-sheen-white rounded-xl shadow-sm overflow-hidden">
                  {getItemImage(item.name, item.image_url) ? (
                    <img src={getItemImage(item.name, item.image_url)} alt={item.name} className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 bg-sheen-cream flex items-center justify-center text-3xl">☕</div>
                  )}
                  <div className="p-3">
                    <h3 className="font-body font-medium text-sheen-black text-sm leading-tight">{item.name}</h3>
                    <p className="font-display text-base font-semibold text-sheen-brown mt-1">{item.selling_price} AED</p>
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
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Floating Cart Button */}
        {cartCount > 0 && !showCart && (
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
          <div className="fixed inset-0 z-30 bg-black/50 flex items-end justify-center" onClick={() => setShowCart(false)}>
            <div className="bg-sheen-white w-full max-w-lg rounded-t-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-sheen-white border-b border-sheen-cream px-5 py-4 flex items-center justify-between">
                <h2 className="font-display text-lg text-sheen-black">{t('yourOrder')}</h2>
                <button onClick={() => setShowCart(false)} className="text-sheen-muted hover:text-sheen-black text-xl">&times;</button>
              </div>

              <div className="p-5 space-y-3">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm text-sheen-black">{item.name}</p>
                      <p className="font-body text-xs text-sheen-muted">{item.selling_price} AED x {item.qty}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-body text-sm font-semibold text-sheen-brown">{item.total.toFixed(2)} AED</span>
                      <button onClick={() => { const next = { ...quantities }; delete next[item.id]; setQuantities(next) }} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </div>
                  </div>
                ))}

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
                  <div className="flex justify-between mb-4">
                    <span className="font-body font-semibold text-sheen-black">{t('total')}</span>
                    <span className="font-display text-xl font-bold text-sheen-brown">{cartTotal.toFixed(2)} AED</span>
                  </div>
                  <Button
                    onClick={() => submitOrder.mutate()}
                    disabled={submitOrder.isPending}
                    className="w-full"
                  >
                    {submitOrder.isPending ? t('submitting') : t('submitOrder')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* My Orders */}
        {myOrders.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-xl text-sheen-black mb-4">{t('myOrders')}</h2>
            <div className="space-y-3">
              {myOrders.slice(0, 10).map((order: Order) => (
                <div key={order.id} className="bg-sheen-white rounded-xl shadow-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-body text-xs text-sheen-muted">
                      {format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-body font-medium ${statusColor[order.status]}`}>
                      {t(order.status as any)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(order.order_items ?? []).map((item: OrderItem, idx: number) => (
                      <span key={idx} className="bg-sheen-cream text-sheen-black text-xs font-body px-2 py-1 rounded-md">
                        {item.name} x{item.qty}
                      </span>
                    ))}
                  </div>
                  <p className="font-body text-sm font-semibold text-sheen-brown">{order.total_amount.toFixed(2)} AED</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
