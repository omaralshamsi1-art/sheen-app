import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import TopBar from '../components/layout/TopBar'
import { useLanguage } from '../i18n/LanguageContext'
import { format } from 'date-fns'

const ENTITIES = ['', 'sale', 'expense', 'fixed_cost', 'menu_item', 'order', 'user_role'] as const
const ACTIONS = ['', 'create', 'update', 'delete'] as const

interface AuditEntry {
  id: string
  user_email: string | null
  action: string
  entity: string
  entity_id: string | null
  details: Record<string, any> | null
  created_at: string
}

export default function AuditLog() {
  const { t } = useLanguage()
  const [filterEntity, setFilterEntity] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterEmail, setFilterEmail] = useState('')

  const { data: logs = [], isLoading } = useQuery<AuditEntry[]>({
    queryKey: ['audit', filterEntity, filterAction, filterEmail],
    queryFn: async () => {
      const params: Record<string, string> = { limit: '200' }
      if (filterEntity) params.entity = filterEntity
      if (filterAction) params.action = filterAction
      if (filterEmail) params.email = filterEmail
      const { data } = await api.get('/api/audit', { params })
      return data
    },
    staleTime: 10_000,
  })

  const actionColor: Record<string, string> = {
    create: 'bg-green-100 text-green-700',
    update: 'bg-blue-100 text-blue-700',
    delete: 'bg-red-100 text-red-700',
  }

  const entityLabel: Record<string, string> = {
    sale: t('sales'),
    expense: t('expenses'),
    fixed_cost: t('fixedCosts'),
    menu_item: t('menu'),
    order: 'Order',
    user_role: 'User',
  }

  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title={t('auditLog')} />

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            className="px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
          >
            <option value="">{t('all')} — {t('category')}</option>
            {ENTITIES.filter(Boolean).map((e) => (
              <option key={e} value={e}>{entityLabel[e] ?? e}</option>
            ))}
          </select>

          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
          >
            <option value="">{t('all')} — Action</option>
            {ACTIONS.filter(Boolean).map((a) => (
              <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
            ))}
          </select>

          <input
            type="text"
            value={filterEmail}
            onChange={(e) => setFilterEmail(e.target.value)}
            placeholder={t('email')}
            className="px-3 py-2 rounded-lg border border-sheen-muted/30 font-body text-sm focus:outline-none focus:ring-1 focus:ring-sheen-gold"
          />
        </div>

        {/* Log entries */}
        <div className="bg-sheen-white rounded-xl shadow-sm overflow-hidden">
          {isLoading ? (
            <p className="p-6 font-body text-sheen-muted">{t('loading')}</p>
          ) : logs.length === 0 ? (
            <p className="p-6 font-body text-sheen-muted">{t('noData')}</p>
          ) : (
            <div className="divide-y divide-sheen-muted/10">
              {logs.map((log) => (
                <div key={log.id} className="px-5 py-3 hover:bg-sheen-cream/40 transition-colors">
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Action badge */}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-body font-medium ${actionColor[log.action] ?? 'bg-gray-100 text-gray-700'}`}>
                      {log.action.toUpperCase()}
                    </span>

                    {/* Entity badge */}
                    <span className="px-2 py-0.5 rounded-full text-xs font-body bg-sheen-cream text-sheen-brown">
                      {entityLabel[log.entity] ?? log.entity}
                    </span>

                    {/* User email */}
                    <span className="font-body text-sm text-sheen-black font-medium">
                      {log.user_email ?? 'System'}
                    </span>

                    {/* Timestamp */}
                    <span className="font-body text-xs text-sheen-muted ml-auto">
                      {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>

                  {/* Details */}
                  {log.details && (
                    <pre className="mt-2 text-xs font-body text-sheen-muted bg-sheen-cream/50 rounded-lg p-2 overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
