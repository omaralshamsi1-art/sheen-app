import { useEffect, useState } from 'react'
import api from '../lib/api'
import Button from './ui/Button'
import { useLanguage } from '../i18n/LanguageContext'
import toast from 'react-hot-toast'

/**
 * Admin tool to broadcast a discount/announcement push notification to all
 * customers. Hidden until push is configured on the server (returns 501 / status).
 */
export default function SendNotification() {
  const { t } = useLanguage()
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    api
      .get('/api/push/status')
      .then((r) => setConfigured(Boolean(r.data?.configured)))
      .catch(() => setConfigured(false))
  }, [])

  if (!configured) return null

  const send = async () => {
    if (!title.trim() || !body.trim()) return
    setSending(true)
    try {
      const { data } = await api.post('/api/push/send', { title: title.trim(), body: body.trim() })
      toast.success(`${t('notificationSent')} (${data.sent})`)
      setTitle('')
      setBody('')
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('notificationFailed'))
    }
    setSending(false)
  }

  return (
    <div className="bg-sheen-white rounded-xl shadow-sm p-5 mb-6">
      <h2 className="font-display text-lg text-sheen-black">{t('sendNotification')}</h2>
      <p className="font-body text-xs text-sheen-muted mt-0.5 mb-3">{t('sendNotificationDesc')}</p>

      <input
        type="text"
        value={title}
        maxLength={100}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('notificationTitlePlaceholder')}
        className="w-full px-3 py-2 mb-2 rounded-lg border border-sheen-muted/40 bg-sheen-cream font-body text-sm text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold"
      />
      <textarea
        value={body}
        maxLength={240}
        rows={2}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t('notificationBodyPlaceholder')}
        className="w-full px-3 py-2 mb-3 rounded-lg border border-sheen-muted/40 bg-sheen-cream font-body text-sm text-sheen-black focus:outline-none focus:ring-1 focus:ring-sheen-gold resize-none"
      />
      <div className="flex justify-end">
        <Button onClick={send} disabled={sending || !title.trim() || !body.trim()}>
          {sending ? t('sending') : t('sendNotification')}
        </Button>
      </div>
    </div>
  )
}
