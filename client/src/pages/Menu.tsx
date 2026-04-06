import { useState } from 'react'
import { useMenuItems } from '../hooks/useFixedCosts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { MenuItem, RecipeLine, MenuCategory } from '../types'
import TopBar from '../components/layout/TopBar'
import { useLanguage } from '../i18n/LanguageContext'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import axios from 'axios'
import toast from 'react-hot-toast'
import { getItemImage } from '../data/itemImages'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '' })

// Gross margin percentage for a menu item
function grossMarginPct(item: MenuItem): number {
  const cost = (item.estimated_cogs ?? 0) + (item.packaging_cost ?? 0)
  if (!item.selling_price || item.selling_price === 0) return 0
  return ((item.selling_price - cost) / item.selling_price) * 100
}

// Margin badge color based on threshold
function MarginBadge({ pct }: { pct: number }) {
  let colorClass = 'bg-red-500'
  if (pct >= 75) colorClass = 'bg-green-500'
  else if (pct >= 60) colorClass = 'bg-yellow-500'

  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-white text-[10px] font-bold ${colorClass}`}
      title={`Gross margin: ${pct.toFixed(1)}%`}
    >
      {Math.round(pct)}%
    </span>
  )
}

export default function Menu() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const { data: menuItems = [], isLoading } = useMenuItems()

  const [activeCategory, setActiveCategory] = useState<MenuCategory | 'All'>('All')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<MenuItem | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [recalculating, setRecalculating] = useState(false)

  // Extract unique categories from items
  const categories = Array.from(
    new Set(menuItems.map((item) => item.category).filter(Boolean)),
  ) as MenuCategory[]

  // Filter items by active category
  const filteredItems =
    activeCategory === 'All'
      ? menuItems
      : menuItems.filter((item) => item.category === activeCategory)

  // Fetch recipe lines for an expanded item
  const { data: recipeLines = [], isFetching: recipeFetching } = useQuery<RecipeLine[]>({
    queryKey: ['recipe', expandedId],
    queryFn: async () => {
      if (!expandedId) return []
      const { data } = await api.get(`/api/menu/${expandedId}/recipes`)
      return data
    },
    enabled: expandedId !== null,
  })

  // Open edit modal
  function openEditModal(item: MenuItem) {
    setEditItem(item)
    setEditPrice(String(item.selling_price ?? ''))
    setEditActive(item.is_active ?? true)
  }

  // Save edit via PATCH
  async function handleSaveEdit() {
    if (!editItem) return
    setSaving(true)
    try {
      await api.patch(`/api/menu/${editItem.id}`, {
        selling_price: Number(editPrice),
        is_active: editActive,
      })
      toast.success(t('menuItemUpdated'))
      queryClient.invalidateQueries({ queryKey: ['menu-items'] })
      setEditItem(null)
    } catch {
      toast.error('Failed to update menu item')
    } finally {
      setSaving(false)
    }
  }

  // Recalculate all margins
  async function handleRecalculate() {
    setRecalculating(true)
    try {
      await api.post('/api/menu/recalculate')
      toast.success(t('marginsRecalculated'))
      queryClient.invalidateQueries({ queryKey: ['menu-items'] })
    } catch {
      toast.error('Failed to recalculate margins')
    } finally {
      setRecalculating(false)
    }
  }

  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title={t('menu')} />

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Toolbar: category filter tabs + recalculate button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory('All')}
              className={`rounded-full px-4 py-1.5 text-sm font-body transition-colors ${
                activeCategory === 'All'
                  ? 'bg-sheen-black text-sheen-white'
                  : 'bg-white text-sheen-muted hover:bg-sheen-black/5'
              }`}
            >
              {t('all')}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-4 py-1.5 text-sm font-body transition-colors ${
                  activeCategory === cat
                    ? 'bg-sheen-black text-sheen-white'
                    : 'bg-white text-sheen-muted hover:bg-sheen-black/5'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <Button onClick={handleRecalculate} disabled={recalculating}>
            {recalculating ? t('recalculating') : t('recalculateAllMargins')}
          </Button>
        </div>

        {/* Menu items list */}
        {isLoading ? (
          <p className="text-center font-body text-sheen-muted py-12">{t('loadingMenuItems')}</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-center font-body text-sheen-muted py-12">
            {t('noMenuItemsFound')}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const margin = grossMarginPct(item)
              const isExpanded = expandedId === item.id
              const grossMarginAED =
                (item.selling_price ?? 0) -
                (item.estimated_cogs ?? 0) -
                (item.packaging_cost ?? 0)

              return (
                <div
                  key={item.id}
                  className="rounded-xl bg-white shadow-sm overflow-hidden"
                >
                  {/* Main row */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
                    {/* Item photo */}
                    {getItemImage(item.name) ? (
                      <img
                        src={getItemImage(item.name)}
                        alt={item.name}
                        className="w-16 h-16 rounded-xl object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-sheen-cream flex items-center justify-center shrink-0 text-2xl">
                        ☕
                      </div>
                    )}

                    {/* Margin badge */}
                    <MarginBadge pct={margin} />

                    {/* Name + category */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display text-sm text-sheen-black truncate">
                          {item.name}
                        </span>
                        {!item.is_active && (
                          <span className="rounded-full bg-sheen-muted/20 px-2 py-0.5 text-[10px] font-body text-sheen-muted">
                            {t('inactive')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-body text-sheen-muted">{item.category}</p>
                    </div>

                    {/* Price columns */}
                    <div className="grid grid-cols-4 gap-4 text-right text-sm font-body">
                      <div>
                        <p className="text-[10px] text-sheen-muted uppercase">{t('price')}</p>
                        <p className="text-sheen-black">
                          د.إ {(item.selling_price ?? 0).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-sheen-muted uppercase">{t('cogs')}</p>
                        <p className="text-sheen-black">
                          د.إ {(item.estimated_cogs ?? 0).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-sheen-muted uppercase">{t('pkg')}</p>
                        <p className="text-sheen-black">
                          د.إ {(item.packaging_cost ?? 0).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-sheen-muted uppercase">{t('margin')}</p>
                        <p className="text-sheen-brown font-semibold">
                          {margin.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="rounded-lg px-3 py-1.5 text-xs font-body text-sheen-muted hover:bg-sheen-cream transition-colors"
                      >
                        {isExpanded ? t('collapse') : t('recipe')}
                      </button>
                      <button
                        onClick={() => openEditModal(item)}
                        className="rounded-lg px-3 py-1.5 text-xs font-body text-sheen-gold hover:bg-sheen-gold/10 transition-colors"
                      >
                        {t('edit')}
                      </button>
                    </div>
                  </div>

                  {/* Expanded recipe section */}
                  {isExpanded && (
                    <div className="border-t border-sheen-cream px-5 py-4 bg-sheen-cream/30">
                      <h4 className="font-display text-sm text-sheen-black mb-3">
                        {t('recipeLines')}
                      </h4>
                      {recipeFetching ? (
                        <p className="text-xs font-body text-sheen-muted">{t('loadingRecipe')}</p>
                      ) : recipeLines.length === 0 ? (
                        <p className="text-xs font-body text-sheen-muted">
                          {t('noRecipeLines')}
                        </p>
                      ) : (
                        <table className="w-full text-sm font-body">
                          <thead>
                            <tr className="text-left text-xs text-sheen-muted uppercase">
                              <th className="pb-2">{t('ingredient')}</th>
                              <th className="pb-2 text-right">{t('quantity')}</th>
                              <th className="pb-2 text-right">{t('unit')}</th>
                              <th className="pb-2 text-right">{t('cost')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recipeLines.map((line, idx) => (
                              <tr key={idx} className="border-t border-sheen-cream/50">
                                <td className="py-1.5 text-sheen-black">
                                  Ingredient #{line.ingredient_id}
                                </td>
                                <td className="py-1.5 text-right text-sheen-black">
                                  {line.qty}
                                </td>
                                <td className="py-1.5 text-right text-sheen-muted">
                                  {line.unit ?? ''}
                                </td>
                                <td className="py-1.5 text-right text-sheen-brown">
                                  د.إ {(line.line_cost ?? 0).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-sheen-cream">
                              <td
                                colSpan={3}
                                className="pt-2 font-semibold text-sheen-black text-right"
                              >
                                {t('totalCOGS')}
                              </td>
                              <td className="pt-2 text-right font-semibold text-sheen-brown">
                                د.إ {recipeLines
                                  .reduce((s, l) => s + (l.line_cost ?? 0), 0)
                                  .toFixed(2)}
                              </td>
                            </tr>
                            <tr>
                              <td
                                colSpan={3}
                                className="pt-1 text-sheen-black text-right"
                              >
                                {t('grossMargin')}
                              </td>
                              <td className="pt-1 text-right font-semibold text-sheen-gold">
                                د.إ {grossMarginAED.toFixed(2)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editItem && (
        <Modal open={true} title={`Edit: ${editItem.name}`} onClose={() => setEditItem(null)}>
          <div className="space-y-5">

            <div>
              <label className="block text-sm font-body text-sheen-muted mb-1">
                {`${t('sellingPrice')} (AED)`}
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="w-full rounded-lg border border-sheen-cream px-3 py-2 font-body text-sheen-black focus:outline-none focus:ring-2 focus:ring-sheen-gold"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="edit-active"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
                className="h-5 w-5 accent-sheen-gold cursor-pointer"
              />
              <label htmlFor="edit-active" className="text-sm font-body text-sheen-black">
                {t('activeOnMenu')}
              </label>
            </div>

            {/* Preview updated margin */}
            {editPrice && (
              <div className="rounded-lg bg-sheen-cream/50 p-3">
                <p className="text-xs font-body text-sheen-muted mb-1">{t('updatedMarginPreview')}</p>
                {(() => {
                  const price = Number(editPrice)
                  const cost = (editItem.estimated_cogs ?? 0) + (editItem.packaging_cost ?? 0)
                  const newMargin = price > 0 ? ((price - cost) / price) * 100 : 0
                  return (
                    <div className="flex items-center gap-2">
                      <MarginBadge pct={newMargin} />
                      <span className="font-body text-sm text-sheen-black">
                        {newMargin.toFixed(1)}% (د.إ {(price - cost).toFixed(2)} {t('perCup')})
                      </span>
                    </div>
                  )
                })()}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving ? t('saving') : t('saveChanges')}
              </Button>
              <button
                onClick={() => setEditItem(null)}
                className="text-sm font-body text-sheen-muted hover:text-sheen-black transition-colors"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
