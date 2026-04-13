import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import TopBar from '../components/layout/TopBar'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { useLanguage } from '../i18n/LanguageContext'
import toast from 'react-hot-toast'
import type { Ingredient, IngredientCategory } from '../types'

const CATEGORIES: IngredientCategory[] = ['Coffee', 'Dairy', 'Matcha', 'Packaging', 'Fruit', 'Syrup', 'Baking', 'Other']
const emptyForm = { name: '', category: 'Coffee' as IngredientCategory, unit: 'grams', pack_size: '', pack_cost: '', cost_per_unit: '', notes: '' }

function FormFields({ f, setF }: { f: typeof emptyForm; setF: (v: typeof emptyForm) => void }) {
  const { t } = useLanguage()
  const inputCls = "w-full px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-body text-sheen-muted mb-1">{t('ingredient')}</label>
        <input type="text" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className="block text-sm font-body text-sheen-muted mb-1">{t('category')}</label>
        <select value={f.category} onChange={e => setF({ ...f, category: e.target.value as IngredientCategory })} className={inputCls}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-body text-sheen-muted mb-1">{t('unit')}</label>
        <select value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} className={inputCls}>
          <option value="grams">grams</option>
          <option value="ml">ml</option>
          <option value="piece">piece</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-body text-sheen-muted mb-1">Pack Size</label>
        <input type="text" value={f.pack_size} onChange={e => setF({ ...f, pack_size: e.target.value })} placeholder="e.g. 1000g bag" className={inputCls} />
      </div>
      <div>
        <label className="block text-sm font-body text-sheen-muted mb-1">Pack Cost (AED)</label>
        <input type="number" min="0" step="0.01" value={f.pack_cost} onChange={e => setF({ ...f, pack_cost: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className="block text-sm font-body text-sheen-muted mb-1">Cost / Unit (AED)</label>
        <input type="number" min="0" step="0.0001" value={f.cost_per_unit} onChange={e => setF({ ...f, cost_per_unit: e.target.value })} className={inputCls} />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-sm font-body text-sheen-muted mb-1">{t('notes')}</label>
        <input type="text" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className={inputCls} />
      </div>
    </div>
  )
}

export default function Ingredients() {
  const { t } = useLanguage()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<IngredientCategory | 'All'>('All')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editItem, setEditItem] = useState<Ingredient | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)

  const { data: ingredients = [], isLoading } = useQuery<Ingredient[]>({
    queryKey: ['ingredients'],
    queryFn: async () => { const { data } = await api.get('/api/ingredients'); return data },
  })

  const filtered = filter === 'All' ? ingredients : ingredients.filter(i => i.category === filter)

  const addMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/ingredients', { ...form, pack_cost: Number(form.pack_cost) || 0, cost_per_unit: Number(form.cost_per_unit) || 0, notes: form.notes || undefined })
      return data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ingredients'] }); toast.success('Saved'); setForm(emptyForm); setShowAdd(false) },
    onError: () => toast.error('Failed'),
  })

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!editItem) return
      await api.patch(`/api/ingredients/${editItem.id}`, { ...editForm, pack_cost: Number(editForm.pack_cost) || 0, cost_per_unit: Number(editForm.cost_per_unit) || 0, notes: editForm.notes || null })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ingredients'] }); toast.success('Saved'); setEditItem(null) },
    onError: () => toast.error('Failed'),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/ingredients/${id}`) },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ingredients'] }); toast.success('Deleted') },
    onError: () => toast.error('Failed'),
  })

  const openEdit = (ing: Ingredient) => {
    setEditItem(ing)
    setEditForm({ name: ing.name, category: ing.category, unit: ing.unit, pack_size: ing.pack_size ?? '', pack_cost: String(ing.pack_cost ?? ''), cost_per_unit: String(ing.cost_per_unit ?? ''), notes: ing.notes ?? '' })
  }

  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title={t('ingredients')} />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-3xl text-sheen-black">{t('ingredients')}</h1>
          <Button onClick={() => setShowAdd(!showAdd)}>{showAdd ? t('cancel') : t('addIngredient')}</Button>
        </div>

        {showAdd && (
          <div className="bg-sheen-white rounded-xl shadow-sm p-5 mb-6">
            <h2 className="font-display text-lg text-sheen-black mb-4">{t('addIngredient')}</h2>
            <FormFields f={form} setF={setForm} />
            <div className="mt-4">
              <Button onClick={() => addMut.mutate()} disabled={!form.name.trim() || addMut.isPending}>
                {addMut.isPending ? t('saving') : t('save')}
              </Button>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          <button onClick={() => setFilter('All')} className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-body transition-colors ${filter === 'All' ? 'bg-sheen-black text-white' : 'bg-sheen-white text-sheen-muted border border-sheen-muted/30'}`}>
            {t('all')} ({ingredients.length})
          </button>
          {CATEGORIES.map(c => {
            const n = ingredients.filter(i => i.category === c).length
            return n ? (
              <button key={c} onClick={() => setFilter(c)} className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-body transition-colors ${filter === c ? 'bg-sheen-black text-white' : 'bg-sheen-white text-sheen-muted border border-sheen-muted/30'}`}>
                {c} ({n})
              </button>
            ) : null
          })}
        </div>

        <div className="bg-sheen-white rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <p className="p-6 font-body text-sheen-muted">{t('loading')}</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 font-body text-sheen-muted">{t('noData')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-sheen-muted/20 text-left text-xs text-sheen-muted uppercase">
                    <th className="px-4 py-3">{t('ingredient')}</th>
                    <th className="px-4 py-3">{t('category')}</th>
                    <th className="px-4 py-3">{t('unit')}</th>
                    <th className="px-4 py-3 text-right">Pack</th>
                    <th className="px-4 py-3 text-right">Pack Cost</th>
                    <th className="px-4 py-3 text-right">Cost/Unit</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sheen-muted/10">
                  {filtered.map(ing => (
                    <tr key={ing.id} className="hover:bg-sheen-cream/40 transition-colors">
                      <td className="px-4 py-3 text-sheen-black font-medium">
                        {ing.name}
                        {ing.notes && <span className="ml-2 text-[10px] text-sheen-muted">({ing.notes})</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full bg-sheen-cream text-sheen-brown text-xs">{ing.category}</span>
                      </td>
                      <td className="px-4 py-3 text-sheen-muted">{ing.unit}</td>
                      <td className="px-4 py-3 text-right text-sheen-muted">{ing.pack_size || '\u2014'}</td>
                      <td className="px-4 py-3 text-right text-sheen-black">{Number(ing.pack_cost).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-sheen-brown font-semibold">{Number(ing.cost_per_unit).toFixed(4)}</td>
                      <td className="px-4 py-3 text-right">
                        {(() => {
                          const qty = Number(ing.stock_qty ?? 0)
                          const isLow = qty > 0 && qty < 200
                          return (
                            <span className={`font-semibold ${qty === 0 ? 'text-red-500' : isLow ? 'text-orange-500' : 'text-green-600'}`}>
                              {qty > 0 ? `${qty.toFixed(qty < 10 ? 1 : 0)} ${ing.unit}` : '—'}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => openEdit(ing)} className="text-sheen-gold hover:text-sheen-brown text-xs font-medium transition-colors">{t('edit')}</button>
                          <button onClick={() => { if (confirm(`Delete ${ing.name}?`)) deleteMut.mutate(ing.id) }} className="text-red-500 hover:text-red-700 text-xs transition-colors">{t('delete')}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {editItem && (
        <Modal open={true} title={`${t('edit')}: ${editItem.name}`} onClose={() => setEditItem(null)}>
          <FormFields f={editForm} setF={setEditForm} />
          <div className="mt-4 flex gap-3">
            <Button onClick={() => updateMut.mutate()} disabled={!editForm.name.trim() || updateMut.isPending}>
              {updateMut.isPending ? t('saving') : t('saveChanges')}
            </Button>
            <button onClick={() => setEditItem(null)} className="text-sm font-body text-sheen-muted hover:text-sheen-black">{t('cancel')}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
