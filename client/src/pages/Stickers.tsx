import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import TopBar from '../components/layout/TopBar'
import Button from '../components/ui/Button'
import { useLanguage } from '../i18n/LanguageContext'
import toast from 'react-hot-toast'

interface StickerMessage {
  id: string
  message_ar: string
  message_en: string
  is_active: boolean
  created_at: string
}

export default function Stickers() {
  const { t } = useLanguage()
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [newAr, setNewAr] = useState('')
  const [newEn, setNewEn] = useState('')

  const { data: messages = [], isLoading } = useQuery<StickerMessage[]>({
    queryKey: ['stickers'],
    queryFn: async () => { const { data } = await api.get('/api/stickers'); return data },
  })

  const addMut = useMutation({
    mutationFn: async () => {
      await api.post('/api/stickers', { message_ar: newAr.trim(), message_en: newEn.trim() })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stickers'] }); toast.success(t('save')); setNewAr(''); setNewEn(''); setShowAdd(false) },
    onError: () => toast.error('Failed'),
  })

  const toggleMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await api.patch(`/api/stickers/${id}`, { is_active })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stickers'] }) },
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/stickers/${id}`) },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stickers'] }); toast.success(t('delete')) },
  })

  const activeCount = messages.filter(m => m.is_active).length

  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title={t('stickerMessages')} />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl text-sheen-black">{t('stickerMessages')}</h1>
            <p className="font-body text-sm text-sheen-muted mt-1">{activeCount} {t('active')} / {messages.length} {t('total')}</p>
          </div>
          <Button onClick={() => setShowAdd(!showAdd)}>{showAdd ? t('cancel') : t('addMessage')}</Button>
        </div>

        {showAdd && (
          <div className="bg-sheen-white rounded-xl shadow-sm p-5 mb-6">
            <h2 className="font-display text-lg text-sheen-black mb-4">{t('addMessage')}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-body text-sheen-muted mb-1">{t('messageAr')}</label>
                <input type="text" value={newAr} onChange={e => setNewAr(e.target.value)} dir="rtl"
                  placeholder="القهوة ما تحلى إلا معك ☕"
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold" />
              </div>
              <div>
                <label className="block text-sm font-body text-sheen-muted mb-1">{t('messageEn')}</label>
                <input type="text" value={newEn} onChange={e => setNewEn(e.target.value)}
                  placeholder="Coffee is only sweet with you"
                  className="w-full px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold" />
              </div>
              <Button onClick={() => addMut.mutate()} disabled={!newAr.trim() || !newEn.trim() || addMut.isPending}>
                {addMut.isPending ? t('saving') : t('save')}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {isLoading ? (
            <p className="text-center font-body text-sheen-muted py-12">{t('loading')}</p>
          ) : messages.length === 0 ? (
            <p className="text-center font-body text-sheen-muted py-12">{t('noData')}</p>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`bg-sheen-white rounded-xl shadow-sm p-4 flex items-start gap-4 transition-opacity ${msg.is_active ? '' : 'opacity-50'}`}>
                <input
                  type="checkbox"
                  checked={msg.is_active}
                  onChange={() => toggleMut.mutate({ id: msg.id, is_active: !msg.is_active })}
                  className="mt-1 h-5 w-5 accent-sheen-gold cursor-pointer shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-body text-base text-sheen-black leading-relaxed" dir="rtl">{msg.message_ar}</p>
                  <p className="font-body text-xs text-sheen-muted mt-1">{msg.message_en}</p>
                </div>
                <button
                  onClick={() => { if (confirm('Delete?')) deleteMut.mutate(msg.id) }}
                  className="text-red-400 hover:text-red-600 text-xs font-body shrink-0 transition-colors"
                >
                  {t('delete')}
                </button>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
