import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useMenuItems } from '../hooks/useFixedCosts'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../i18n/LanguageContext'
import { getOffers } from '../services/offerService'
import { createOrder } from '../services/orderService'
import { createPaymentIntent } from '../services/paymentService'
import { availableWallet, payWithWallet } from '../native/pay'
import { getItemImage } from '../data/itemImages'
import StripeCheckout from '../components/StripeCheckout'
import type { MenuItem, MenuCategory, Offer } from '../types'
import type { TranslationKey } from '../i18n/translations'

/* ---- Design tokens (scoped to this page; see design handoff) ---- */
const T = {
  bg: '#FBF7F1', surface: '#FFFFFF', espresso: '#2B201A', muted: '#93857A',
  muted2: '#A89A8C', onDark: '#FBF7F1', hair: '#ECE3D7', cardBorder: '#EFE7DB',
  chipBorder: '#E4D9CB', tabBorder: '#E8DECF', terracotta: '#C2603C',
  badgeBg: '#F3E1D6', struck: '#B7AB9E', scrim: 'rgba(30,20,14,.42)',
}
const FONT_DISPLAY = "'Bricolage Grotesque', sans-serif"
const FONT_BODY = "'Hanken Grotesk', 'Tajawal', sans-serif"

const GRAD: Record<string, [string, string]> = {
  Coffee: ['#6F4A2F', '#9C6B43'], Matcha: ['#5F7340', '#92A568'],
  'Açaí': ['#6E4763', '#9B6A8C'], 'Cold Drinks': ['#3F7C77', '#74AAA3'],
  Desserts: ['#B07F33', '#D9B468'], Bites: ['#B07F33', '#D9B468'], Beans: ['#6F4A2F', '#9C6B43'],
}
const CAT_EMOJI: Record<string, string> = {
  Coffee: '☕', Matcha: '🍵', 'Açaí': '🫐', 'Cold Drinks': '🧊',
  Desserts: '🍰', Bites: '🥐', Beans: '🫘',
}
const CATEGORIES: MenuCategory[] = ['Coffee', 'Matcha', 'Cold Drinks', 'Açaí', 'Desserts', 'Bites', 'Beans']
const CAT_KEY: Record<string, TranslationKey> = {
  Coffee: 'catCoffee', Matcha: 'catMatcha', 'Cold Drinks': 'catColdDrinks',
  'Açaí': 'catAcai', Desserts: 'catDesserts', Bites: 'catBites', Beans: 'catBeans',
}
const NEW_DAYS = 30
function isNewItem(it: MenuItem): boolean {
  const t = Date.parse(it.created_at)
  return Number.isFinite(t) && (Date.now() - t) < NEW_DAYS * 86_400_000
}

type Tab = 'offers' | 'new' | 'menu'
type CartLine = { key: string; menu_item_id: string; name: string; price: number; qty: number }
type MilkOpt = { name: string; premium: number }
type BeanOpt = { name: string; premium: number }

export default function CustomerMenu() {
  const { t, lang, setLang, isRTL } = useLanguage()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const money = (n: number) => (isRTL ? `${n.toFixed(0)} د.إ` : `AED ${n.toFixed(0)}`)

  const { data: menuItems = [] } = useMenuItems()
  const { data: offers = [] } = useQuery({ queryKey: ['offers'], queryFn: getOffers })

  // Customization settings (same sources as the classic order page)
  const { data: extraShotPrice = 5 } = useQuery({
    queryKey: ['settings', 'extra_shot_price'],
    queryFn: async () => { const { data } = await api.get('/api/settings/extra_shot_price'); return Number(data) || 5 },
  })
  const { data: milkOptions = [] } = useQuery({
    queryKey: ['settings', 'milk_options'],
    queryFn: async () => { const { data } = await api.get('/api/settings/milk_options'); return (data as MilkOpt[]) ?? [] },
  })
  const { data: beanOptions = [] } = useQuery({
    queryKey: ['settings', 'bean_options'],
    queryFn: async () => { const { data } = await api.get('/api/settings/bean_options'); return (data as BeanOpt[]) ?? [] },
  })
  const milkPremium = (n: string) => milkOptions.find(m => m.name === n)?.premium ?? 0
  const beanPremium = (n: string) => beanOptions.find(b => b.name === n)?.premium ?? 0

  const [tab, setTab] = useState<Tab>('offers')
  const [category, setCategory] = useState<MenuCategory | 'all'>('all')
  const [cart, setCart] = useState<Record<string, CartLine>>({})
  const [cartOpen, setCartOpen] = useState(false)
  const [customizing, setCustomizing] = useState<MenuItem | null>(null)
  const [pickingOffer, setPickingOffer] = useState<Offer | null>(null)

  // Checkout (reused Apple Pay + card flow)
  const [walletReady, setWalletReady] = useState(false)
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let cancelled = false
    availableWallet().then(s => { if (!cancelled) setWalletReady(s.wallet === 'apple') })
    return () => { cancelled = true }
  }, [])

  const fallbackItemId = menuItems[0]?.id ?? ''

  const addLine = useCallback((line: CartLine) => {
    setCart(prev => {
      const existing = prev[line.key]
      return { ...prev, [line.key]: existing ? { ...existing, qty: existing.qty + line.qty } : line }
    })
  }, [])
  const changeQty = (key: string, delta: number) => {
    setCart(prev => {
      const l = prev[key]; if (!l) return prev
      const qty = l.qty + delta
      const next = { ...prev }
      if (qty <= 0) delete next[key]; else next[key] = { ...l, qty }
      return next
    })
  }

  const addMenuItem = (it: MenuItem) => {
    const customizable = it.category === 'Coffee' && ((it.available_beans?.length ?? 0) > 0 || (it.available_milks?.length ?? 0) > 0 || it.show_extra_shot)
    if (customizable) { setCustomizing(it); return }
    addLine({ key: it.id, menu_item_id: it.id, name: it.name, price: it.selling_price, qty: 1 })
  }
  const itemName = (id: string) => menuItems.find(m => m.id === id)?.name
  const itemPrice = (id: string) => menuItems.find(m => m.id === id)?.selling_price ?? 0
  // Final + original price for an offer given the chosen choice-group items.
  const offerPrice = (o: Offer, chosen: string[]): { final: number; original: number | null } => {
    if (o.discount_percent == null) return { final: o.price, original: o.original_price ?? null }
    const ids = [...(o.menu_item_ids ?? []), ...chosen]
    const base = ids.reduce((s, id) => s + itemPrice(id), 0)
    return { final: Math.round(base * (1 - o.discount_percent / 100)), original: base }
  }
  const defaultChoice = (o: Offer) => (o.slots ?? []).map(s => s.options[0] || '')

  const addOffer = (o: Offer) => {
    if (o.slots?.length) { setPickingOffer(o); return }
    finalizeOffer(o, [])
  }
  const finalizeOffer = (o: Offer, chosen: string[]) => {
    const fixed = o.menu_item_ids ?? []
    const allIds = [...fixed, ...chosen]
    const parts = allIds.map(itemName).filter(Boolean)
    const name = parts.length ? `${o.name} (${parts.join(' + ')})` : o.name
    addLine({ key: `offer:${o.id}:${chosen.join(',')}`, menu_item_id: allIds[0] || fallbackItemId, name, price: offerPrice(o, chosen).final, qty: 1 })
    setPickingOffer(null)
  }

  const cartLines = Object.values(cart)
  const count = cartLines.reduce((s, l) => s + l.qty, 0)
  const total = cartLines.reduce((s, l) => s + l.price * l.qty, 0)

  /* ---- New-arrivals list ---- */
  const newItems = useMemo(() => menuItems.filter(m => m.is_active && isNewItem(m)), [menuItems])
  /* ---- Menu grouped by category (for sticky chips + scroll-spy) ---- */
  const grouped = useMemo(
    () => CATEGORIES.map(c => ({ cat: c, items: menuItems.filter(m => m.is_active && m.category === c) })).filter(g => g.items.length > 0),
    [menuItems],
  )

  // Find the scrolling ancestor (AppLayout's <main>) so chips can scroll-spy.
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLElement | null>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const chipsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let el: HTMLElement | null = rootRef.current
    while (el && el !== document.body) {
      const oy = getComputedStyle(el).overflowY
      if (oy === 'auto' || oy === 'scroll') { scrollRef.current = el; break }
      el = el.parentElement
    }
  }, [])

  const goToCategory = (c: MenuCategory | 'all') => {
    setCategory(c)
    if (c === 'all') { scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); return }
    sectionRefs.current[c]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Scroll-spy: highlight the category section currently at the top.
  useEffect(() => {
    if (tab !== 'menu') return
    const root = scrollRef.current
    if (!root) return
    const io = new IntersectionObserver((entries) => {
      if (root.scrollTop < 60) { setCategory('all'); return } // near top → All
      const vis = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      const c = vis[0]?.target.getAttribute('data-cat')
      if (c) setCategory(c as MenuCategory)
    }, { root, rootMargin: '-140px 0px -55% 0px', threshold: 0 })
    grouped.forEach(g => { const el = sectionRefs.current[g.cat]; if (el) io.observe(el) })
    const onScroll = () => { if (root.scrollTop < 60) setCategory('all') }
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => { io.disconnect(); root.removeEventListener('scroll', onScroll) }
  }, [tab, grouped])

  // Slide the (horizontal) chip bar so the active category chip stays in view.
  useEffect(() => {
    if (tab !== 'menu') return
    const bar = chipsRef.current
    const el = bar?.querySelector('[data-active="true"]') as HTMLElement | null
    if (bar && el) bar.scrollTo({ left: el.offsetLeft - bar.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' })
  }, [category, tab])

  /* ---- Checkout ---- */
  const placeOrder = async (paymentNote: string) => {
    if (cartLines.length === 0) return
    await createOrder({
      customer_id: user!.id,
      customer_email: user!.email,
      customer_name: user!.user_metadata?.full_name || user!.user_metadata?.name || user!.email?.split('@')[0] || user!.email,
      items: cartLines.map(l => ({ menu_item_id: l.menu_item_id, name: l.name, price: l.price, qty: l.qty })),
      notes: paymentNote,
    })
    toast.success(t('orderSubmitted'))
    setCart({})
    setCartOpen(false)
    setStripeClientSecret(null)
    queryClient.invalidateQueries({ queryKey: ['orders'] })
  }
  const handleApplePay = async () => {
    setBusy(true)
    try {
      const { clientSecret } = await createPaymentIntent(total, user?.email ?? undefined)
      const paid = await payWithWallet('apple', clientSecret, total)
      if (paid) await placeOrder(`[Payment: Apple Pay - Stripe: ${clientSecret.split('_secret')[0]}]`)
    } catch (e: any) {
      toast.error(e?.message || t('paymentFailed'))
    } finally { setBusy(false) }
  }
  const handleCardPayment = async () => {
    setBusy(true)
    try {
      const { clientSecret } = await createPaymentIntent(total, user?.email ?? undefined)
      setStripeClientSecret(clientSecret)
    } catch { toast.error(t('paymentFailed')) } finally { setBusy(false) }
  }
  const handlePaymentSuccess = async (paymentIntentId: string) => {
    try { await placeOrder(`[Payment: Card/Wallet - Stripe: ${paymentIntentId}]`) }
    catch { toast.error(t('orderFailed')) }
  }

  return (
    <div ref={rootRef} dir={isRTL ? 'rtl' : 'ltr'} style={{ background: T.bg, color: T.espresso, fontFamily: FONT_BODY, minHeight: '100vh' }}>
      <div style={{ maxWidth: 440, margin: '0 auto', minHeight: '100vh', position: 'relative' }}>
        {/* Header */}
        <div
          style={{ position: 'sticky', top: 0, zIndex: 20, background: T.bg, borderBottom: `1px solid ${T.hair}`, paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 18px 12px', paddingInlineStart: 56 }}>
            <div>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 25, letterSpacing: '.16em', lineHeight: 1 }}>SHEEN</div>
              <div style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: '#9A8B7C', marginTop: 4 }}>{t('coffeeShop')}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <button
                onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
                style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${T.chipBorder}`, background: T.surface, color: T.espresso, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >{lang === 'en' ? 'ع' : 'EN'}</button>
              <button
                onClick={() => setCartOpen(true)}
                style={{ position: 'relative', width: 34, height: 34, borderRadius: 10, border: `1px solid ${T.chipBorder}`, background: T.surface, color: T.espresso, fontSize: 15, cursor: 'pointer' }}
              >
                🛍
                {count > 0 && (
                  <span style={{ position: 'absolute', top: -6, insetInlineEnd: -6, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 9, background: T.terracotta, color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>
                )}
              </button>
            </div>
          </div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 7, padding: '0 16px 11px' }}>
            {([['offers', t('tabOffers')], ['new', t('tabNew')], ['menu', t('tabMenu')]] as [Tab, string][]).map(([key, label]) => {
              const active = tab === key
              return (
                <button key={key} onClick={() => setTab(key)} style={{
                  flex: 1, padding: '9px 0', borderRadius: 11, fontFamily: FONT_BODY, fontSize: 13.5,
                  fontWeight: active ? 700 : 500, background: active ? '#8B4513' : '#FFFFFF',
                  color: active ? '#FFFFFF' : '#1A1A1A', border: `1px solid ${active ? '#8B4513' : '#A0785A'}`,
                  cursor: 'pointer', transition: 'all .18s',
                }}>{label}</button>
              )
            })}
          </div>
          {/* Category chips — sticky with the header on the Menu tab */}
          {tab === 'menu' && (
            <div ref={chipsRef} style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px 11px' }} className="no-scrollbar">
              {(['all', ...CATEGORIES] as (MenuCategory | 'all')[]).map(c => {
                const active = category === c
                const label = c === 'all' ? t('catAll') : t(CAT_KEY[c])
                return (
                  <button key={c} data-active={active} onClick={() => goToCategory(c)} style={{
                    padding: '7px 14px', borderRadius: 999,
                    border: `1px solid ${active ? '#8B4513' : '#A0785A'}`, background: active ? '#8B4513' : '#FFFFFF',
                    color: active ? '#FFFFFF' : '#1A1A1A', fontSize: 12.5, fontWeight: active ? 700 : 500,
                    whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all .18s',
                  }}>
                    {label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Scroll content */}
        <div style={{ padding: '2px 16px 110px' }}>
          {tab === 'offers' ? (
            <>
              <SectionHeading>{t('headingCurrentOffers')}</SectionHeading>
              {offers.length === 0
                ? <Empty text={t('noOffers')} />
                : offers.map(o => {
                  const { final, original } = offerPrice(o, defaultChoice(o))
                  const badge = o.discount_percent != null ? `-${o.discount_percent}%` : (original && original > final ? `${t('save')} ${money(original - final)}` : '')
                  return (
                    <Row key={o.id} category={o.category} image={o.image_url || undefined} title={o.name} secondary={o.description || ''}
                      badge={badge}
                      price={((o.slots?.length ?? 0) > 0 ? '~' : '') + money(final)}
                      oldPrice={original && original > final ? money(original) : ''}
                      onAdd={() => addOffer(o)} />
                  )
                })}
            </>
          ) : tab === 'new' ? (
            <>
              <SectionHeading>{t('headingNewArrivals')}</SectionHeading>
              {newItems.length === 0
                ? <Empty text={t('noItemsHere')} />
                : newItems.map(it => (
                  <Row key={it.id} category={it.category} image={getItemImage(it.name, it.image_url)}
                    title={it.name} secondary={it.description || ''} badge={t('badgeNew')}
                    price={money(it.selling_price)} oldPrice="" onAdd={() => addMenuItem(it)} />
                ))}
            </>
          ) : grouped.length === 0 ? (
            <Empty text={t('noItemsHere')} />
          ) : (
            grouped.map(g => (
              <div key={g.cat} ref={el => { sectionRefs.current[g.cat] = el }} data-cat={g.cat} style={{ scrollMarginTop: 132 }}>
                <SectionHeading>{t(CAT_KEY[g.cat])}</SectionHeading>
                {g.items.map(it => (
                  <Row key={it.id} category={it.category} image={getItemImage(it.name, it.image_url)}
                    title={it.name} secondary={it.description || ''} badge={isNewItem(it) ? t('badgeNew') : ''}
                    price={money(it.selling_price)} oldPrice="" onAdd={() => addMenuItem(it)} />
                ))}
              </div>
            ))
          )}
        </div>

        {/* Sticky order bar */}
        {count > 0 && !cartOpen && (
          <button onClick={() => setCartOpen(true)} style={{
            position: 'fixed', insetInlineStart: 'max(16px, calc(50vw - 220px + 16px))', insetInlineEnd: 'max(16px, calc(50vw - 220px + 16px))',
            bottom: 16, height: 54, border: 'none', borderRadius: 16, background: T.espresso, color: T.onDark,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', cursor: 'pointer',
            boxShadow: '0 14px 30px -10px rgba(43,32,26,.55)', maxWidth: 408, marginInline: 'auto', zIndex: 30,
          }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>🛍 {count} {t('itemsLabel')}</span>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{money(total)} →</span>
          </button>
        )}

        {/* Cart drawer */}
        {cartOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, maxWidth: 440, margin: '0 auto' }}>
            <div onClick={() => { if (!busy) { setCartOpen(false); setStripeClientSecret(null) } }} style={{ position: 'absolute', inset: 0, background: T.scrim }} />
            <div style={{ position: 'absolute', insetInline: 0, bottom: 0, background: T.bg, borderRadius: '26px 26px 0 0', padding: '18px 18px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -14px 44px rgba(30,20,14,.28)', maxHeight: '86%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 19 }}>{t('cartTitle')}</span>
                <button onClick={() => { setCartOpen(false); setStripeClientSecret(null) }} style={{ border: 'none', background: '#EFE7DB', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', color: T.espresso }}>✕</button>
              </div>

              {cartLines.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '34px 0', color: T.muted, fontSize: 14 }}>☕<div style={{ marginTop: 8 }}>{t('cartEmpty')}</div></div>
              ) : (
                <>
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {cartLines.map(l => (
                      <div key={l.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderBottom: `1px solid ${T.hair}` }}>
                        <span style={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }}>{l.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <button onClick={() => changeQty(l.key, -1)} style={stepBtn}>−</button>
                          <span style={{ minWidth: 18, textAlign: 'center', fontWeight: 700 }}>{l.qty}</span>
                          <button onClick={() => changeQty(l.key, 1)} style={stepBtn}>+</button>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 13.5, minWidth: 70, textAlign: 'end' }}>{money(l.price * l.qty)}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 0 12px' }}>
                    <span style={{ color: T.muted, fontSize: 14 }}>{t('total')}</span>
                    <span style={{ fontWeight: 800, fontSize: 21, fontFamily: FONT_DISPLAY }}>{money(total)}</span>
                  </div>

                  {stripeClientSecret ? (
                    <StripeCheckout clientSecret={stripeClientSecret} amount={total} onSuccess={handlePaymentSuccess} onCancel={() => setStripeClientSecret(null)} />
                  ) : (
                    <>
                      {walletReady && (
                        <button onClick={handleApplePay} disabled={busy} style={{ width: '100%', height: 50, border: 'none', borderRadius: 14, background: '#000', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 10, opacity: busy ? 0.6 : 1 }}>
                          {busy ? t('processing') : ' Pay'}
                        </button>
                      )}
                      <button onClick={handleCardPayment} disabled={busy} style={{ width: '100%', height: 50, border: 'none', borderRadius: 14, background: T.espresso, color: T.onDark, fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
                        {busy ? t('processing') : t('payByCard')}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Offer choice picker */}
        {pickingOffer && (
          <OfferPicker
            offer={pickingOffer}
            itemName={itemName}
            money={money}
            compute={(chosen) => offerPrice(pickingOffer, chosen)}
            onClose={() => setPickingOffer(null)}
            onConfirm={(chosen) => finalizeOffer(pickingOffer, chosen)}
            t={t}
          />
        )}

        {/* Customization sheet */}
        {customizing && (
          <CustomizeSheet
            item={customizing}
            beanOptions={beanOptions}
            milkOptions={milkOptions}
            extraShotPrice={extraShotPrice}
            beanPremium={beanPremium}
            milkPremium={milkPremium}
            money={money}
            onClose={() => setCustomizing(null)}
            onAdd={(line) => { addLine(line); setCustomizing(null) }}
            t={t}
          />
        )}
      </div>
    </div>
  )
}

const stepBtn: React.CSSProperties = { width: 28, height: 28, borderRadius: 8, border: `1px solid ${T.chipBorder}`, background: '#fff', color: T.espresso, fontSize: 16, cursor: 'pointer', lineHeight: 1 }

function Empty({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', padding: '40px 8px', color: T.muted, fontSize: 14, fontFamily: FONT_BODY }}>{text}</div>
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 19, margin: '8px 0 13px' }}>{children}</div>
}

function Row(props: {
  category: string; image?: string; title: string; secondary: string; badge?: string;
  price: string; oldPrice?: string; onAdd: () => void
}) {
  const g = GRAD[props.category] || GRAD.Coffee
  return (
    <div style={{ display: 'flex', gap: 13, alignItems: 'center', background: T.surface, border: `1px solid ${T.cardBorder}`, borderRadius: 18, padding: 11, marginBottom: 11, boxShadow: '0 1px 2px rgba(43,32,26,.04)' }}>
      <div style={{ flex: '0 0 auto', width: 78, height: 78, borderRadius: 14, overflow: 'hidden', background: `linear-gradient(140deg,${g[0]},${g[1]})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)', fontSize: 27 }}>
        {props.image ? <img src={props.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (CAT_EMOJI[props.category] || '☕')}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{props.title}</span>
          {props.badge && <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.06em', background: T.badgeBg, color: T.terracotta, padding: '2px 6px', borderRadius: 6 }}>{props.badge}</span>}
        </div>
        {props.secondary && <div style={{ fontSize: 12, color: T.muted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{props.secondary}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{props.price}</span>
          {props.oldPrice && <span style={{ fontSize: 12, color: T.struck, textDecoration: 'line-through' }}>{props.oldPrice}</span>}
        </div>
      </div>
      <button onClick={props.onAdd} aria-label="add" style={{ flex: '0 0 auto', alignSelf: 'center', width: 40, height: 40, borderRadius: 12, border: 'none', background: T.espresso, color: T.onDark, fontSize: 18, cursor: 'pointer' }}>+</button>
    </div>
  )
}

function CustomizeSheet(props: {
  item: MenuItem; beanOptions: BeanOpt[]; milkOptions: MilkOpt[]; extraShotPrice: number
  beanPremium: (n: string) => number; milkPremium: (n: string) => number; money: (n: number) => string
  onClose: () => void; onAdd: (line: CartLine) => void; t: (k: TranslationKey) => string
}) {
  const { item, t } = props
  const beans = item.available_beans?.length ? item.available_beans : props.beanOptions.map(b => b.name)
  const milks = item.available_milks?.length ? item.available_milks : []
  const [bean, setBean] = useState(beans[0] || '')
  const [milk, setMilk] = useState('')
  const [shot, setShot] = useState(false)

  const price = item.selling_price + (bean ? props.beanPremium(bean) : 0) + (milk ? props.milkPremium(milk) : 0) + (shot ? props.extraShotPrice : 0)
  const submit = () => {
    let name = item.name
    if (bean) name += ` (${bean})`
    if (milk) name += ` [${milk}]`
    if (shot) name += ' +1shot'
    const key = `${item.id}|${bean}|${milk}|${shot ? 1 : 0}`
    props.onAdd({ key, menu_item_id: item.id, name, price, qty: 1 })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, maxWidth: 440, margin: '0 auto' }}>
      <div onClick={props.onClose} style={{ position: 'absolute', inset: 0, background: T.scrim }} />
      <div style={{ position: 'absolute', insetInline: 0, bottom: 0, background: T.bg, borderRadius: '26px 26px 0 0', padding: '18px 18px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -14px 44px rgba(30,20,14,.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18 }}>{item.name}</span>
          <button onClick={props.onClose} style={{ border: 'none', background: '#EFE7DB', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', color: T.espresso }}>✕</button>
        </div>

        {beans.length > 0 && (
          <Field label={t('beanLabel')}>
            <select value={bean} onChange={e => setBean(e.target.value)} style={selectStyle}>
              {beans.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </Field>
        )}
        {milks.length > 0 && (
          <Field label={t('milkLabel')}>
            <select value={milk} onChange={e => setMilk(e.target.value)} style={selectStyle}>
              <option value="">—</option>
              {milks.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
        )}
        {item.show_extra_shot && (
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{t('extraShotLabel')} (+{props.money(props.extraShotPrice)})</span>
            <input type="checkbox" checked={shot} onChange={e => setShot(e.target.checked)} style={{ width: 20, height: 20 }} />
          </label>
        )}

        <button onClick={submit} style={{ marginTop: 14, width: '100%', height: 50, border: 'none', borderRadius: 14, background: T.espresso, color: T.onDark, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          {t('addToCart')} · {props.money(price)}
        </button>
      </div>
    </div>
  )
}

function OfferPicker(props: {
  offer: Offer; itemName: (id: string) => string | undefined; money: (n: number) => string
  compute: (chosen: string[]) => { final: number; original: number | null }
  onClose: () => void; onConfirm: (chosen: string[]) => void; t: (k: TranslationKey) => string
}) {
  const { offer, t } = props
  const slots = offer.slots ?? []
  const [choices, setChoices] = useState<string[]>(slots.map(s => s.options[0] || ''))
  const set = (i: number, v: string) => setChoices(c => c.map((x, idx) => idx === i ? v : x))
  const ready = slots.every((_, i) => choices[i])
  const { final, original } = props.compute(choices)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, maxWidth: 440, margin: '0 auto' }}>
      <div onClick={props.onClose} style={{ position: 'absolute', inset: 0, background: T.scrim }} />
      <div style={{ position: 'absolute', insetInline: 0, bottom: 0, background: T.bg, borderRadius: '26px 26px 0 0', padding: '18px 18px calc(24px + env(safe-area-inset-bottom))', boxShadow: '0 -14px 44px rgba(30,20,14,.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18 }}>{offer.name}</span>
          <button onClick={props.onClose} style={{ border: 'none', background: '#EFE7DB', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', color: T.espresso }}>✕</button>
        </div>
        {offer.description && <div style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>{offer.description}</div>}

        {slots.map((s, i) => (
          <Field key={i} label={s.label || `${t('customizeTitle')} ${i + 1}`}>
            <select value={choices[i]} onChange={e => set(i, e.target.value)} style={selectStyle}>
              {s.options.map(id => <option key={id} value={id}>{props.itemName(id) || id}</option>)}
            </select>
          </Field>
        ))}

        <button onClick={() => props.onConfirm(choices)} disabled={!ready} style={{ marginTop: 8, width: '100%', height: 50, border: 'none', borderRadius: 14, background: T.espresso, color: T.onDark, fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: ready ? 1 : 0.5 }}>
          {t('addToCart')} · {props.money(final)}
          {original && original > final ? <span style={{ textDecoration: 'line-through', opacity: 0.6, marginInlineStart: 8, fontWeight: 400 }}>{props.money(original)}</span> : null}
        </button>
      </div>
    </div>
  )
}

const selectStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${T.chipBorder}`, background: '#fff', fontSize: 14, color: T.espresso }
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}
