import { useState } from 'react'
import { useMenuItems } from '../hooks/useFixedCosts'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useIngredients } from '../hooks/useExpenses'
import type { MenuItem, RecipeLine, MenuCategory, Ingredient } from '../types'
import TopBar from '../components/layout/TopBar'
import { useLanguage } from '../i18n/LanguageContext'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import api from '../lib/api'
import toast from 'react-hot-toast'
import { getItemImage } from '../data/itemImages'
import { supabase } from '../lib/supabase'

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
  const [addingRecipeTo, setAddingRecipeTo] = useState<string | null>(null)
  const [newIngredientId, setNewIngredientId] = useState('')
  const [newQty, setNewQty] = useState('')

  const { data: ingredients = [] } = useIngredients()

  // Add item state
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState<MenuCategory>('Coffee')
  const [newPrice, setNewPrice] = useState('')
  const [newCogs, setNewCogs] = useState('')
  const [newPkg, setNewPkg] = useState('')
  const [adding, setAdding] = useState(false)
  const [newImageFile, setNewImageFile] = useState<File | null>(null)
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null)

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

  // Recipe mutations
  const addRecipeLine = useMutation({
    mutationFn: async ({ menuItemId, ingredient_id, qty }: { menuItemId: string; ingredient_id: string; qty: number }) => {
      const { data } = await api.post(`/api/menu/${menuItemId}/recipes`, { ingredient_id, qty })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe'] })
      queryClient.invalidateQueries({ queryKey: ['menu-items'] })
      toast.success(t('recipeUpdated'))
      setNewIngredientId('')
      setNewQty('')
      setAddingRecipeTo(null)
    },
    onError: () => toast.error('Failed to add ingredient'),
  })

  const removeRecipeLine = useMutation({
    mutationFn: async ({ menuItemId, lineId }: { menuItemId: string; lineId: string }) => {
      await api.delete(`/api/menu/${menuItemId}/recipes/${lineId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe'] })
      queryClient.invalidateQueries({ queryKey: ['menu-items'] })
      toast.success(t('recipeUpdated'))
    },
    onError: () => toast.error('Failed to remove ingredient'),
  })

  // Handle image file selection
  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setNewImageFile(file)
    setNewImagePreview(URL.createObjectURL(file))
  }

  // Add new menu item
  async function handleAddItem() {
    if (!newName.trim() || !newPrice) return
    setAdding(true)
    try {
      let image_url: string | undefined

      // Upload image to Supabase Storage if selected
      if (newImageFile) {
        const itemId = newName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
        const ext = newImageFile.name.split('.').pop() || 'jpg'
        const filePath = `${itemId}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from('menu-images')
          .upload(filePath, newImageFile, { upsert: true })

        if (uploadErr) throw uploadErr

        const { data: urlData } = supabase.storage
          .from('menu-images')
          .getPublicUrl(filePath)

        image_url = urlData.publicUrl
      }

      await api.post('/api/menu', {
        name: newName.trim(),
        category: newCategory,
        selling_price: Number(newPrice),
        estimated_cogs: Number(newCogs) || 0,
        packaging_cost: Number(newPkg) || 0,
        ...(image_url ? { image_url } : {}),
      })
      toast.success(t('menuItemAdded'))
      queryClient.invalidateQueries({ queryKey: ['menu-items'] })
      setNewName('')
      setNewPrice('')
      setNewCogs('')
      setNewPkg('')
      setNewImageFile(null)
      setNewImagePreview(null)
      setShowAddForm(false)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add item')
    } finally {
      setAdding(false)
    }
  }

  // Preview margin for new item
  const newMarginPreview = (() => {
    const price = Number(newPrice) || 0
    const cogs = Number(newCogs) || 0
    const pkg = Number(newPkg) || 0
    if (price <= 0) return 0
    return ((price - cogs - pkg) / price) * 100
  })()

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

          <div className="flex gap-2">
            <Button onClick={() => setShowAddForm(!showAddForm)}>
              {showAddForm ? t('cancel') : t('addMenuItem')}
            </Button>
            <Button onClick={handleRecalculate} disabled={recalculating}>
              {recalculating ? t('recalculating') : t('recalculateAllMargins')}
            </Button>
          </div>
        </div>

        {/* Add Item Form */}
        {showAddForm && (
          <div className="bg-sheen-white rounded-xl shadow-sm p-6">
            <h2 className="font-display text-lg text-sheen-black mb-4">{t('addMenuItem')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-body text-sheen-muted mb-1">{t('itemName')}</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Iced Latte"
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-body text-sheen-muted mb-1">{t('category')}</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as MenuCategory)}
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                >
                  {(['Coffee', 'Matcha', 'Cold Drinks', 'Açaí', 'Desserts', 'Bites'] as MenuCategory[]).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-body text-sheen-muted mb-1">{t('sellingPrice')} (AED)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-body text-sheen-muted mb-1">{t('estimatedCOGS')} (AED)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={newCogs}
                  onChange={(e) => setNewCogs(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-body text-sheen-muted mb-1">{t('packagingCost')} (AED)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={newPkg}
                  onChange={(e) => setNewPkg(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/40 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                />
              </div>
              {/* Image upload */}
              <div>
                <label className="block text-sm font-body text-sheen-muted mb-1">{t('productImage')}</label>
                <div className="flex items-center gap-3">
                  {newImagePreview ? (
                    <img src={newImagePreview} alt="Preview" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-sheen-cream flex items-center justify-center shrink-0 text-xl text-sheen-muted">
                      +
                    </div>
                  )}
                  <label className="cursor-pointer px-3 py-2 rounded-lg border border-sheen-muted/40 font-body text-sm text-sheen-brown hover:bg-sheen-gold/10 transition-colors">
                    {newImageFile ? newImageFile.name : t('chooseImage')}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              {newPrice && (
                <div className="flex items-end pb-1">
                  <div className="flex items-center gap-2">
                    <MarginBadge pct={newMarginPreview} />
                    <span className="font-body text-sm text-sheen-black">{newMarginPreview.toFixed(1)}% {t('margin')}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4">
              <Button onClick={handleAddItem} disabled={!newName.trim() || !newPrice || adding}>
                {adding ? t('saving') : t('addMenuItem')}
              </Button>
            </div>
          </div>
        )}

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
                    {getItemImage(item.name, item.image_url) ? (
                      <img
                        src={getItemImage(item.name, item.image_url)}
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
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-display text-sm text-sheen-black">
                          {t('recipeLines')}
                        </h4>
                        <button
                          onClick={() => setAddingRecipeTo(addingRecipeTo === item.id ? null : item.id)}
                          className="text-xs font-body text-sheen-gold hover:text-sheen-brown transition-colors font-medium"
                        >
                          {addingRecipeTo === item.id ? t('cancel') : `+ ${t('addIngredient')}`}
                        </button>
                      </div>

                      {/* Add ingredient form */}
                      {addingRecipeTo === item.id && (
                        <div className="flex gap-2 mb-3 flex-wrap">
                          <select
                            value={newIngredientId}
                            onChange={(e) => setNewIngredientId(e.target.value)}
                            className="flex-1 min-w-[150px] px-2 py-1.5 rounded-lg border border-sheen-muted/30 font-body text-xs focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                          >
                            <option value="">{t('selectIngredient')}</option>
                            {ingredients.map((ing: Ingredient) => (
                              <option key={ing.id} value={ing.id}>
                                {ing.name} ({ing.unit}) — {Number(ing.cost_per_unit).toFixed(4)}/unit
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={newQty}
                            onChange={(e) => setNewQty(e.target.value)}
                            placeholder={t('quantity')}
                            className="w-20 px-2 py-1.5 rounded-lg border border-sheen-muted/30 font-body text-xs focus:outline-none focus:ring-1 focus:ring-sheen-gold"
                          />
                          <Button
                            size="sm"
                            onClick={() => addRecipeLine.mutate({ menuItemId: item.id, ingredient_id: newIngredientId, qty: Number(newQty) })}
                            disabled={!newIngredientId || !newQty || Number(newQty) <= 0 || addRecipeLine.isPending}
                          >
                            {t('add')}
                          </Button>
                        </div>
                      )}

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
                              <th className="pb-2 w-8"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {recipeLines.map((line: any) => (
                              <tr key={line.id} className="border-t border-sheen-cream/50">
                                <td className="py-1.5 text-sheen-black">
                                  {line.ingredient_name || `#${line.ingredient_id}`}
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
                                <td className="py-1.5 text-right">
                                  <button
                                    onClick={() => removeRecipeLine.mutate({ menuItemId: item.id, lineId: line.id })}
                                    disabled={removeRecipeLine.isPending}
                                    className="text-red-400 hover:text-red-600 text-xs disabled:opacity-50"
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-sheen-cream">
                              <td colSpan={3} className="pt-2 font-semibold text-sheen-black text-right">
                                {t('totalCOGS')}
                              </td>
                              <td className="pt-2 text-right font-semibold text-sheen-brown">
                                د.إ {recipeLines.reduce((s: number, l: any) => s + (l.line_cost ?? 0), 0).toFixed(2)}
                              </td>
                              <td></td>
                            </tr>
                            <tr>
                              <td colSpan={3} className="pt-1 text-sheen-black text-right">
                                {t('grossMargin')}
                              </td>
                              <td className="pt-1 text-right font-semibold text-sheen-gold">
                                د.إ {grossMarginAED.toFixed(2)}
                              </td>
                              <td></td>
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
