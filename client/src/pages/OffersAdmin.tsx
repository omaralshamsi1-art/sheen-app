import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import TopBar from '../components/layout/TopBar'
import Button from '../components/ui/Button'
import { useMenuItems } from '../hooks/useFixedCosts'
import { getAllOffers, createOffer, updateOffer, deleteOffer, type OfferInput } from '../services/offerService'
import type { Offer, MenuCategory } from '../types'

const CATEGORIES: MenuCategory[] = ['Coffee', 'Matcha', 'Cold Drinks', 'Açaí', 'Desserts', 'Bites', 'Beans']

const empty: OfferInput = { name: '', description: '', price: 0, original_price: null, category: 'Coffee', menu_item_id: null, is_active: true, sort_order: 0 }

export default function OffersAdmin() {
  const qc = useQueryClient()
  const { data: menuItems = [] } = useMenuItems()
  const { data: offers = [], isLoading } = useQuery({ queryKey: ['offers', 'all'], queryFn: getAllOffers })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<OfferInput>(empty)

  const reset = () => { setEditingId(null); setForm(empty) }
  const refresh = () => { qc.invalidateQueries({ queryKey: ['offers'] }) }

  const save = useMutation({
    mutationFn: () => {
      const payload: OfferInput = {
        ...form,
        price: Number(form.price),
        original_price: form.original_price ? Number(form.original_price) : null,
      }
      return editingId ? updateOffer(editingId, payload) : createOffer(payload)
    },
    onSuccess: () => { toast.success(editingId ? 'Offer updated' : 'Offer created'); reset(); refresh() },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to save offer'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteOffer(id),
    onSuccess: () => { toast.success('Offer deleted'); refresh() },
    onError: () => toast.error('Failed to delete'),
  })

  const startEdit = (o: Offer) => {
    setEditingId(o.id)
    setForm({ name: o.name, description: o.description ?? '', price: o.price, original_price: o.original_price, category: o.category, menu_item_id: o.menu_item_id, is_active: o.is_active, sort_order: o.sort_order })
  }

  const input = 'w-full rounded-lg border border-sheen-muted/30 bg-sheen-cream/40 px-3 py-2 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold'

  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title="Offers" />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Form */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-4 space-y-3">
          <p className="font-display text-lg font-bold text-sheen-black">{editingId ? 'Edit offer' : 'New offer'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-body text-sheen-muted">Name</span>
              <input className={input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Morning Set" />
            </label>
            <label className="block">
              <span className="text-xs font-body text-sheen-muted">Category (look)</span>
              <select className={input} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-body text-sheen-muted">Description</span>
              <input className={input} value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Any coffee + butter croissant" />
            </label>
            <label className="block">
              <span className="text-xs font-body text-sheen-muted">Price (AED)</span>
              <input type="number" className={input} value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} />
            </label>
            <label className="block">
              <span className="text-xs font-body text-sheen-muted">Original price (optional)</span>
              <input type="number" className={input} value={form.original_price ?? ''} onChange={e => setForm(f => ({ ...f, original_price: e.target.value ? Number(e.target.value) : null }))} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-body text-sheen-muted">Linked menu item (used for ordering)</span>
              <select className={input} value={form.menu_item_id ?? ''} onChange={e => setForm(f => ({ ...f, menu_item_id: e.target.value || null }))}>
                <option value="">— pick an item —</option>
                {menuItems.filter(m => m.is_active).map(m => <option key={m.id} value={m.id}>{m.name} ({m.category})</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input type="checkbox" checked={form.is_active !== false} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
              <span className="text-sm font-body text-sheen-black">Active (visible to customers)</span>
            </label>
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>{editingId ? 'Save changes' : 'Create offer'}</Button>
            {editingId && <button onClick={reset} className="px-4 py-2 text-sm font-body text-sheen-muted hover:text-sheen-black">Cancel</button>}
          </div>
          {!form.menu_item_id && <p className="text-xs font-body text-orange-600">Tip: pick a linked menu item so the offer can be ordered.</p>}
        </div>

        {/* List */}
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-center text-sheen-muted font-body text-sm py-6">Loading…</p>
          ) : offers.length === 0 ? (
            <p className="text-center text-sheen-muted font-body text-sm py-6">No offers yet.</p>
          ) : offers.map(o => (
            <div key={o.id} className="bg-sheen-white rounded-xl shadow-sm p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-body font-semibold text-sheen-black truncate">{o.name}</span>
                  {!o.is_active && <span className="text-[10px] bg-sheen-muted/15 text-sheen-muted px-1.5 py-0.5 rounded">hidden</span>}
                </div>
                <div className="font-body text-xs text-sheen-muted">
                  {o.price} AED{o.original_price ? ` (was ${o.original_price})` : ''} · {o.category}
                  {!o.menu_item_id && <span className="text-orange-600"> · no linked item</span>}
                </div>
              </div>
              <button onClick={() => startEdit(o)} className="text-sm font-body text-sheen-brown hover:underline">Edit</button>
              <button onClick={() => { if (confirm(`Delete "${o.name}"?`)) remove.mutate(o.id) }} className="text-sm font-body text-red-600 hover:underline">Delete</button>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
