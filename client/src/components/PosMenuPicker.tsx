import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMenuItems } from '../hooks/useFixedCosts'
import type { MenuCategory, MenuItem, Offer } from '../types'
import { getOffers } from '../services/offerService'
import { getItemImage } from '../data/itemImages'
import api from '../lib/api'

const CATEGORIES: MenuCategory[] = [
  'Coffee',
  'Matcha',
  'Cold Drinks',
  'Açaí',
  'Desserts',
  'Bites',
  'Beans',
]

type PosTab = MenuCategory | 'Offers'

type Variant = {
  vid: string
  bean?: string
  milk?: string
  shots: number
  addons: string[]
  qty: number
}

export type OrderLine = {
  key: string
  itemId: string
  vid: string | null
  name: string
  category: string
  qty: number
  unitPrice: number
  lineTotal: number
  remove: () => void
}

export function OrderSummary({ lines }: { lines: OrderLine[] }) {
  if (lines.length === 0) return null
  return (
    <div className="rounded-xl border border-sheen-muted/30 bg-sheen-cream/40 overflow-hidden">
      <p className="font-body text-xs text-sheen-muted uppercase tracking-wider px-3 pt-3 pb-1">
        Order ({lines.reduce((s, l) => s + l.qty, 0)} {lines.reduce((s, l) => s + l.qty, 0) === 1 ? 'item' : 'items'})
      </p>
      <div className="divide-y divide-sheen-muted/20">
        {lines.map((l) => (
          <div key={l.key} className="flex items-center gap-2 px-3 py-2">
            <span className="shrink-0 w-7 h-6 flex items-center justify-center rounded bg-sheen-brown/10 text-sheen-brown font-body text-xs font-semibold">
              ×{l.qty}
            </span>
            <span className="flex-1 min-w-0 font-body text-sm text-sheen-black truncate">{l.name}</span>
            <span className="shrink-0 font-body text-sm text-sheen-brown font-semibold">{l.lineTotal.toFixed(2)}</span>
            <button
              onClick={() => l.remove()}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-red-500 hover:bg-red-100 transition-colors"
              aria-label="Remove line"
              title="Remove"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

interface PosMenuPickerProps {
  source?: string
  showOffers?: boolean
  resetSignal?: number
  onChange: (lines: OrderLine[]) => void
}

export default function PosMenuPicker({ source, showOffers = true, resetSignal, onChange }: PosMenuPickerProps) {
  const { data: menuItems = [], isLoading: menuLoading } = useMenuItems()
  const { data: offers = [] } = useQuery({ queryKey: ['offers'], queryFn: getOffers })

  const TABS: PosTab[] = useMemo(() => (showOffers ? [...CATEGORIES, 'Offers'] : [...CATEGORIES]), [showOffers])

  const [activeCategory, setActiveCategory] = useState<PosTab>('Coffee')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [beanChoices, setBeanChoices] = useState<Record<string, string>>({})
  const [milkChoices, setMilkChoices] = useState<Record<string, string>>({})
  const [shotChoices, setShotChoices] = useState<Record<string, number>>({})
  const [addonChoices, setAddonChoices] = useState<Record<string, string[]>>({}) // itemId → array of selected add-on names
  const [variants, setVariants] = useState<Record<string, Variant[]>>({}) // itemId → extra lines with different options

  const { data: extraShotPrice = 5 } = useQuery({
    queryKey: ['settings', 'extra_shot_price'],
    queryFn: async () => {
      const { data } = await api.get('/api/settings/extra_shot_price')
      return Number(data) || 5
    },
  })

  const { data: milkOptions = [] } = useQuery({
    queryKey: ['settings', 'milk_options'],
    queryFn: async () => {
      const { data } = await api.get('/api/settings/milk_options')
      return (data as Array<{ name: string; premium: number }>) ?? []
    },
  })
  const getMilkPremium = (milkName: string) => milkOptions.find(m => m.name === milkName)?.premium ?? 0

  // Fetch bean options from settings (dynamic, managed by admin)
  const { data: beanOptions = [] } = useQuery({
    queryKey: ['settings', 'bean_options'],
    queryFn: async () => {
      const { data } = await api.get('/api/settings/bean_options')
      return (data as Array<{ name: string; premium: number }>) ?? []
    },
  })
  const getBeanPremium = (beanName: string) => beanOptions.find(b => b.name === beanName)?.premium ?? 0

  // Talabat-specific price overrides (delivery platform markup)
  const getBasePrice = useCallback(
    (item: MenuItem) => {
      if (source === 'Talabat') {
        const n = item.name.toLowerCase().trim()
        if (n === 'acai bowl') return 27
        if (n === 'acai smoothie') return 32
      }
      return item.selling_price
    },
    [source],
  )

  // Group menu items by category
  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, MenuItem[]> = {}
    for (const cat of CATEGORIES) {
      grouped[cat] = menuItems.filter((item: MenuItem) => item.category === cat && item.is_active)
    }
    return grouped
  }, [menuItems])

  const currentItems = itemsByCategory[activeCategory] ?? []

  // Quantity helpers
  const getQty = useCallback(
    (itemId: string) => quantities[itemId] ?? 0,
    [quantities],
  )

  const setQty = useCallback((itemId: string, value: number) => {
    const clamped = Math.max(0, Math.floor(value))
    setQuantities((prev) => {
      if (clamped === 0) {
        const next = { ...prev }
        delete next[itemId]
        return next
      }
      return { ...prev, [itemId]: clamped }
    })
  }, [])

  const increment = useCallback(
    (itemId: string) =>
      setQuantities((prev) => ({ ...prev, [itemId]: (prev[itemId] ?? 0) + 1 })),
    [],
  )

  const decrement = useCallback(
    (itemId: string) =>
      setQuantities((prev) => {
        const current = prev[itemId] ?? 0
        if (current <= 1) {
          const next = { ...prev }
          delete next[itemId]
          return next
        }
        return { ...prev, [itemId]: current - 1 }
      }),
    [],
  )

  // Variant helpers — extra lines for the same item with different bean/milk/shots/addons
  const addVariant = useCallback((itemId: string) => {
    setVariants((prev) => {
      const list = prev[itemId] ?? []
      // Seed the new variant from the item's current "main line" options, so
      // "same as above, but tweak" is one tap away.
      const seed: Variant = {
        vid: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `v-${Date.now()}-${Math.random()}`,
        bean: beanChoices[itemId],
        milk: milkChoices[itemId],
        shots: shotChoices[itemId] ?? 0,
        addons: [...(addonChoices[itemId] ?? [])],
        qty: 1,
      }
      return { ...prev, [itemId]: [...list, seed] }
    })
  }, [beanChoices, milkChoices, shotChoices, addonChoices])

  const updateVariant = useCallback((itemId: string, vid: string, patch: Partial<Variant>) => {
    setVariants((prev) => {
      const list = prev[itemId] ?? []
      const next = list.map(v => v.vid === vid ? { ...v, ...patch } : v)
      return { ...prev, [itemId]: next }
    })
  }, [])

  const removeVariant = useCallback((itemId: string, vid: string) => {
    setVariants((prev) => {
      const list = (prev[itemId] ?? []).filter(v => v.vid !== vid)
      const next = { ...prev }
      if (list.length === 0) delete next[itemId]
      else next[itemId] = list
      return next
    })
  }, [])

  // First bean in item.available_beans that still exists in the ingredients
  // list — skips stale entries (e.g. a bean later deleted from ingredients).
  const defaultBeanFor = useCallback(
    (item: MenuItem) => {
      const valid = (item.available_beans ?? []).find(name =>
        beanOptions.some(b => b.name === name),
      )
      return valid || beanOptions[0]?.name || ''
    },
    [beanOptions],
  )

  // Shared line builder — produces the display name + unit price for a given
  // item + chosen options. Used by the order summary, subtotal and record-sale.
  const describeLine = useCallback(
    (item: MenuItem, opts: { bean?: string; milk?: string; shots: number; addons: string[] }) => {
      const beanName = opts.bean || defaultBeanFor(item)
      const beanPremium = item.category === 'Coffee' ? (beanOptions.find(b => b.name === beanName)?.premium ?? 0) : 0
      const milkPremium = opts.milk ? (milkOptions.find(m => m.name === opts.milk)?.premium ?? 0) : 0
      const shotPremium = opts.shots * extraShotPrice
      const addonPremium = opts.addons.reduce((s, name) => s + (item.addons?.find(a => a.name === name)?.price ?? 0), 0)
      const unitPrice = getBasePrice(item) + beanPremium + milkPremium + shotPremium + addonPremium
      let name = item.name
      if (item.category === 'Coffee') name += ` (${beanName || 'Ethiopia'})`
      if (opts.milk) name += ` [${opts.milk}]`
      if (opts.shots > 0) name += ` +${opts.shots}shot`
      if (opts.addons.length > 0) name += ` +${opts.addons.join(', ')}`
      return { name, unitPrice }
    },
    [defaultBeanFor, beanOptions, milkOptions, extraShotPrice, getBasePrice],
  )

  // Resolve an offer to a single sale line (default choices for combos; % off
  // computed from item prices). itemId is a representative menu item (valid FK).
  const offerSaleLine = useCallback((o: Offer) => {
    const fixedIds = o.menu_item_ids ?? []
    const chosen = ((o.slots ?? []).map(s => s.options[0]).filter(Boolean)) as string[]
    const allIds = [...fixedIds, ...chosen]
    const repId = allIds[0] || menuItems[0]?.id || ''
    let price = o.price
    if (o.discount_percent != null) {
      const base = allIds.reduce((s, id) => s + (menuItems.find(m => m.id === id)?.selling_price ?? 0), 0)
      price = Math.round(base * (1 - o.discount_percent / 100))
    }
    const parts = allIds.map(id => menuItems.find(m => m.id === id)?.name).filter(Boolean)
    const name = parts.length ? `${o.name} (${parts.join(' + ')})` : o.name
    return { price, name, itemId: repId }
  }, [menuItems])

  // Flattened order — every line (main + variants) across all categories, for the review summary
  const orderLines = useMemo(() => {
    const lines: OrderLine[] = []
    for (const [id, qty] of Object.entries(quantities)) {
      if (qty <= 0) continue
      if (id.startsWith('offer:')) continue
      const item = menuItems.find((m: MenuItem) => m.id === id)
      if (!item) continue
      const { name, unitPrice } = describeLine(item, {
        bean: beanChoices[id], milk: milkChoices[id], shots: shotChoices[id] ?? 0, addons: addonChoices[id] ?? [],
      })
      lines.push({ key: id, itemId: id, vid: null, name, category: item.category, qty, unitPrice, lineTotal: unitPrice * qty, remove: () => setQty(id, 0) })
    }
    for (const [id, list] of Object.entries(variants)) {
      const item = menuItems.find((m: MenuItem) => m.id === id)
      if (!item) continue
      for (const v of list) {
        if (v.qty <= 0) continue
        const { name, unitPrice } = describeLine(item, { bean: v.bean, milk: v.milk, shots: v.shots, addons: v.addons })
        lines.push({ key: v.vid, itemId: id, vid: v.vid, name, category: item.category, qty: v.qty, unitPrice, lineTotal: unitPrice * v.qty, remove: () => removeVariant(id, v.vid) })
      }
    }
    // Offers (combos) — keyed as `offer:<id>` in quantities
    if (showOffers) {
      for (const o of offers) {
        const qty = quantities[`offer:${o.id}`] ?? 0
        if (qty <= 0) continue
        const { price, name, itemId } = offerSaleLine(o)
        if (!itemId) continue
        lines.push({ key: `offer:${o.id}`, itemId, vid: null, name, category: 'Offers', qty, unitPrice: price, lineTotal: price * qty, remove: () => setQty(`offer:${o.id}`, 0) })
      }
    }
    return lines
  }, [quantities, variants, menuItems, beanChoices, milkChoices, shotChoices, addonChoices, describeLine, offers, offerSaleLine, showOffers, setQty, removeVariant])

  useEffect(() => {
    onChange(orderLines)
  }, [orderLines, onChange])

  useEffect(() => {
    if (resetSignal === undefined) return
    setQuantities({})
    setBeanChoices({})
    setMilkChoices({})
    setShotChoices({})
    setAddonChoices({})
    setVariants({})
  }, [resetSignal])

  // ── Swipe-to-change-category logic ──
  const tabsRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const isSwiping = useRef(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isSwiping.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current)
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current)
    if (deltaX > deltaY && deltaX > 10) {
      isSwiping.current = true
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isSwiping.current) return
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    const threshold = 50
    if (Math.abs(deltaX) < threshold) return

    const currentIndex = TABS.indexOf(activeCategory)
    if (deltaX < 0 && currentIndex < TABS.length - 1) {
      // Swipe left → next category
      setActiveCategory(TABS[currentIndex + 1])
    } else if (deltaX > 0 && currentIndex > 0) {
      // Swipe right → previous category
      setActiveCategory(TABS[currentIndex - 1])
    }
  }

  // Auto-scroll active tab into view
  useEffect(() => {
    if (!tabsRef.current) return
    const activeBtn = tabsRef.current.querySelector('[data-active="true"]') as HTMLElement | null
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [activeCategory])

  return (
    <>
      {/* ── Category Tabs (swipeable) ── */}
      <div
        ref={tabsRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none no-scrollbar snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {TABS.map((cat) => (
          <button
            key={cat}
            data-active={activeCategory === cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-body font-medium transition-colors snap-start ${
              activeCategory === cat
                ? 'bg-sheen-brown text-sheen-white shadow-md'
                : 'bg-sheen-white text-sheen-black border border-sheen-muted hover:bg-sheen-gold/10'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Menu Items Grid (swipeable) ── */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="bg-sheen-white rounded-xl shadow-sm p-6 mb-8"
      >
        {menuLoading ? (
          <p className="text-sheen-muted font-body">Loading menu...</p>
        ) : activeCategory === 'Offers' ? (
          offers.length === 0 ? (
            <p className="text-sheen-muted font-body">No active offers.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {offers.map((o) => {
                const { price, name } = offerSaleLine(o)
                const key = `offer:${o.id}`
                return (
                  <div key={o.id} className="border border-sheen-muted/30 rounded-xl p-4 flex flex-col">
                    <div className="flex items-center gap-3 min-w-0">
                      {o.image_url ? (
                        <img src={o.image_url} alt={o.name} loading="lazy" className="w-20 h-20 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-sheen-cream flex items-center justify-center shrink-0 text-3xl">🎁</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-body font-semibold text-sheen-black text-base leading-tight truncate">{o.name}</p>
                        <p className="font-body text-base font-semibold text-sheen-brown mt-0.5">
                          {price.toFixed(2)} د.إ{o.discount_percent != null ? ` (-${o.discount_percent}%)` : ''}
                        </p>
                        {(o.slots?.length ?? 0) > 0 && <p className="font-body text-[10px] text-sheen-muted truncate">{name}</p>}
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-1.5 mt-3">
                      <button onClick={() => decrement(key)} disabled={getQty(key) === 0} className="w-9 h-9 flex items-center justify-center rounded-lg bg-sheen-cream text-sheen-black font-bold text-base hover:bg-sheen-gold/20 disabled:opacity-30 transition-colors">&minus;</button>
                      <input type="number" min={0} value={getQty(key)} onChange={(e) => setQty(key, parseInt(e.target.value, 10) || 0)} className="w-12 h-9 text-center font-body text-sm font-semibold border border-sheen-muted/40 rounded-lg bg-sheen-cream focus:outline-none focus:ring-1 focus:ring-sheen-gold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                      <button onClick={() => increment(key)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-sheen-brown text-white font-bold text-base hover:bg-sheen-brown/90 transition-colors">+</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : currentItems.length === 0 ? (
          <p className="text-sheen-muted font-body">
            No items in this category.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {currentItems.map((item: MenuItem) => (
              <div
                key={item.id}
                className="border border-sheen-muted/30 rounded-xl p-4 flex flex-col"
              >
                {/* Top: image + name + price */}
                <div className="flex items-center gap-3 min-w-0">
                  {getItemImage(item.name, item.image_url) ? (
                    <img
                      src={getItemImage(item.name, item.image_url)}
                      alt={item.name}
                      loading="lazy"
                      decoding="async"
                      className="w-20 h-20 rounded-xl object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-sheen-cream flex items-center justify-center shrink-0 text-3xl">
                      ☕
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-body font-semibold text-sheen-black text-base leading-tight truncate">
                      {item.name}
                    </p>
                    <p className="font-body text-base font-semibold text-sheen-brown mt-0.5">
                      {getBasePrice(item)
                        + (item.category === 'Coffee' ? getBeanPremium(beanChoices[item.id] || defaultBeanFor(item)) : 0)
                        + (milkChoices[item.id] ? getMilkPremium(milkChoices[item.id]) : 0)
                        + ((shotChoices[item.id] ?? 0) * extraShotPrice)
                        + (addonChoices[item.id] ?? []).reduce((s, name) => s + (item.addons?.find(a => a.name === name)?.price ?? 0), 0)} د.إ
                    </p>
                  </div>
                </div>

                {/* Bean dropdown (Coffee only) */}
                {item.category === 'Coffee' && beanOptions.length > 0 && (
                  <div className="mt-3">
                    <p className="font-body text-[10px] text-sheen-muted uppercase tracking-wider mb-1">
                      Bean: <span className="text-sheen-brown font-semibold normal-case tracking-normal">
                        {beanChoices[item.id] || defaultBeanFor(item) || 'Default'}
                      </span>
                    </p>
                    <select
                      value={beanChoices[item.id] || defaultBeanFor(item)}
                      onChange={(e) => setBeanChoices(prev => ({ ...prev, [item.id]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-sheen-muted/30 bg-sheen-cream font-body text-xs text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                    >
                      {beanOptions.filter(b => !item.available_beans || item.available_beans.length === 0 || item.available_beans.includes(b.name)).map(bean => (
                        <option key={bean.name} value={bean.name}>
                          {bean.name}{bean.premium > 0 ? ` (+${bean.premium} AED)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Extra Shot dropdown (Coffee only, if enabled for this item) */}
                {item.category === 'Coffee' && item.show_extra_shot !== false && (
                  <div className="mt-2">
                    <p className="font-body text-[10px] text-sheen-muted uppercase tracking-wider mb-1">
                      Extra Shot: <span className="text-sheen-brown font-semibold normal-case tracking-normal">
                        {shotChoices[item.id] ? `${shotChoices[item.id]} shot${shotChoices[item.id] > 1 ? 's' : ''}` : 'None'}
                      </span>
                    </p>
                    <select
                      value={shotChoices[item.id] ?? 0}
                      onChange={(e) => setShotChoices(prev => {
                        const next = { ...prev }
                        const n = Number(e.target.value)
                        if (n > 0) next[item.id] = n
                        else delete next[item.id]
                        return next
                      })}
                      className="w-full px-3 py-2 rounded-lg border border-sheen-muted/30 bg-sheen-cream font-body text-xs text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                    >
                      <option value={0}>None</option>
                      <option value={1}>1 shot (+{extraShotPrice} AED)</option>
                      <option value={2}>2 shots (+{extraShotPrice * 2} AED)</option>
                      <option value={3}>3 shots (+{extraShotPrice * 3} AED)</option>
                    </select>
                  </div>
                )}

                {/* Milk add-on dropdown */}
                {item.available_milks && item.available_milks.length > 0 && (
                  <div className="mt-2">
                    <p className="font-body text-[10px] text-sheen-muted uppercase tracking-wider mb-1">
                      Milk: <span className="text-sheen-brown font-semibold normal-case tracking-normal">
                        {milkChoices[item.id] || 'Fresh Milk'}
                      </span>
                    </p>
                    <select
                      value={milkChoices[item.id] || ''}
                      onChange={(e) => setMilkChoices(prev => {
                        const next = { ...prev }
                        if (e.target.value) next[item.id] = e.target.value
                        else delete next[item.id]
                        return next
                      })}
                      className="w-full px-3 py-2 rounded-lg border border-sheen-muted/30 bg-sheen-cream font-body text-xs text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                    >
                      <option value="">Fresh Milk (default)</option>
                      {milkOptions.filter(m => item.available_milks!.includes(m.name)).map(milk => (
                        <option key={milk.name} value={milk.name}>
                          {milk.name}{milk.premium > 0 ? ` (+${milk.premium} AED)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Add-ons (any item with addons configured) */}
                {item.addons && item.addons.length > 0 && (
                  <div className="mt-2">
                    <p className="font-body text-[10px] text-sheen-muted uppercase tracking-wider mb-1">
                      Add-ons {addonChoices[item.id]?.length ? <span className="text-sheen-brown font-semibold normal-case tracking-normal">({addonChoices[item.id].length} selected)</span> : ''}
                    </p>
                    <div className="space-y-1">
                      {item.addons.map((addon, i) => {
                        const checked = addonChoices[item.id]?.includes(addon.name) ?? false
                        return (
                          <label key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-xs ${checked ? 'bg-sheen-gold/10' : 'bg-sheen-cream'}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setAddonChoices(prev => {
                                const list = prev[item.id] ?? []
                                const next = checked ? list.filter(n => n !== addon.name) : [...list, addon.name]
                                return { ...prev, [item.id]: next }
                              })}
                              className="h-4 w-4 accent-sheen-gold cursor-pointer"
                            />
                            <span className="font-body flex-1 text-sheen-black">{addon.name}</span>
                            <span className="font-body text-sheen-gold font-semibold">+{addon.price}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Quantity controls */}
                <div className="flex items-center justify-center gap-1.5 mt-3">
                  <button
                    onClick={() => decrement(item.id)}
                    disabled={getQty(item.id) === 0}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-sheen-cream text-sheen-black font-bold text-base hover:bg-sheen-gold/20 active:bg-sheen-gold/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    &minus;
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={getQty(item.id)}
                    onChange={(e) =>
                      setQty(item.id, parseInt(e.target.value, 10) || 0)
                    }
                    className="w-12 h-9 text-center font-body text-sm font-semibold border border-sheen-muted/40 rounded-lg bg-sheen-cream focus:outline-none focus:ring-1 focus:ring-sheen-gold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => increment(item.id)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-sheen-brown text-white font-bold text-base hover:bg-sheen-brown/90 active:bg-sheen-brown transition-colors"
                  >
                    +
                  </button>
                </div>

                {/* Variant lines — same item with different bean/milk/shots/add-ons */}
                {(variants[item.id] ?? []).map((v, idx) => (
                  <div
                    key={v.vid}
                    className="mt-3 ml-2 pl-3 border-l-2 border-sheen-gold/40 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-body text-[10px] text-sheen-muted uppercase tracking-wider">
                        Variation {idx + 2}
                      </p>
                      <button
                        onClick={() => removeVariant(item.id, v.vid)}
                        className="text-red-500 hover:text-red-700 text-xs font-body"
                      >
                        Remove
                      </button>
                    </div>

                    {item.category === 'Coffee' && beanOptions.length > 0 && (
                      <select
                        value={v.bean || defaultBeanFor(item)}
                        onChange={(e) => updateVariant(item.id, v.vid, { bean: e.target.value })}
                        className="w-full px-2 py-1.5 rounded-lg border border-sheen-muted/30 bg-sheen-cream font-body text-xs text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                      >
                        {beanOptions.filter(b => !item.available_beans || item.available_beans.length === 0 || item.available_beans.includes(b.name)).map(bean => (
                          <option key={bean.name} value={bean.name}>
                            Bean: {bean.name}{bean.premium > 0 ? ` (+${bean.premium})` : ''}
                          </option>
                        ))}
                      </select>
                    )}

                    {item.category === 'Coffee' && item.show_extra_shot !== false && (
                      <select
                        value={v.shots}
                        onChange={(e) => updateVariant(item.id, v.vid, { shots: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 rounded-lg border border-sheen-muted/30 bg-sheen-cream font-body text-xs text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                      >
                        <option value={0}>Shots: None</option>
                        <option value={1}>Shots: 1 (+{extraShotPrice})</option>
                        <option value={2}>Shots: 2 (+{extraShotPrice * 2})</option>
                        <option value={3}>Shots: 3 (+{extraShotPrice * 3})</option>
                      </select>
                    )}

                    {item.available_milks && item.available_milks.length > 0 && (
                      <select
                        value={v.milk || ''}
                        onChange={(e) => updateVariant(item.id, v.vid, { milk: e.target.value || undefined })}
                        className="w-full px-2 py-1.5 rounded-lg border border-sheen-muted/30 bg-sheen-cream font-body text-xs text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                      >
                        <option value="">Milk: Fresh (default)</option>
                        {milkOptions.filter(m => item.available_milks!.includes(m.name)).map(milk => (
                          <option key={milk.name} value={milk.name}>
                            Milk: {milk.name}{milk.premium > 0 ? ` (+${milk.premium})` : ''}
                          </option>
                        ))}
                      </select>
                    )}

                    {item.addons && item.addons.length > 0 && (
                      <div className="space-y-1">
                        {item.addons.map((addon, i) => {
                          const checked = v.addons.includes(addon.name)
                          return (
                            <label key={i} className={`flex items-center gap-2 px-2 py-1 rounded-lg cursor-pointer text-xs ${checked ? 'bg-sheen-gold/10' : 'bg-sheen-cream'}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = checked
                                    ? v.addons.filter(n => n !== addon.name)
                                    : [...v.addons, addon.name]
                                  updateVariant(item.id, v.vid, { addons: next })
                                }}
                                className="h-4 w-4 accent-sheen-gold cursor-pointer"
                              />
                              <span className="font-body flex-1 text-sheen-black">{addon.name}</span>
                              <span className="font-body text-sheen-gold font-semibold">+{addon.price}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}

                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => {
                          if (v.qty <= 1) removeVariant(item.id, v.vid)
                          else updateVariant(item.id, v.vid, { qty: v.qty - 1 })
                        }}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-sheen-cream text-sheen-black font-bold text-base hover:bg-sheen-gold/20 active:bg-sheen-gold/30 transition-colors"
                      >
                        &minus;
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={v.qty}
                        onChange={(e) => updateVariant(item.id, v.vid, { qty: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        className="w-12 h-9 text-center font-body text-sm font-semibold border border-sheen-muted/40 rounded-lg bg-sheen-cream focus:outline-none focus:ring-1 focus:ring-sheen-gold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <button
                        onClick={() => updateVariant(item.id, v.vid, { qty: v.qty + 1 })}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-sheen-brown text-white font-bold text-base hover:bg-sheen-brown/90 active:bg-sheen-brown transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add variation button — shown only for items with at least one customization axis */}
                {(
                  (item.category === 'Coffee' && (beanOptions.length > 0 || item.show_extra_shot !== false)) ||
                  (item.available_milks && item.available_milks.length > 0) ||
                  (item.addons && item.addons.length > 0)
                ) && (
                  <button
                    onClick={() => addVariant(item.id)}
                    className="mt-2 w-full px-3 py-1.5 rounded-lg border border-dashed border-sheen-brown/40 text-sheen-brown font-body text-xs font-medium hover:bg-sheen-brown/5 transition-colors"
                  >
                    + Add variation (different options)
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
