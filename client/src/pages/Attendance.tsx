import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, startOfMonth } from 'date-fns'
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser'
import api from '../lib/api'
import TopBar from '../components/layout/TopBar'
import { useAuth } from '../hooks/useAuth'
import { useRole } from '../hooks/useRole'
import toast from 'react-hot-toast'

interface AttendanceRow {
  id: string
  date: string
  clock_in: string | null
  clock_out: string | null
  in_method: string | null
  out_method: string | null
  notes: string | null
}

interface Credential {
  id: string
  device_label: string | null
  created_at: string
  last_used_at: string | null
}

function uaeNow() {
  const d = new Date()
  d.setHours(d.getHours() + 4)
  return d
}

function uaeDateLabel(iso: string) {
  const d = new Date(iso)
  d.setHours(d.getHours() + 4)
  return d.toISOString().slice(11, 16)
}

function calcHours(inIso: string | null, outIso: string | null): string {
  if (!inIso || !outIso) return '—'
  const ms = new Date(outIso).getTime() - new Date(inIso).getTime()
  if (ms <= 0) return '—'
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  return `${hours}h ${minutes}m`
}

export default function Attendance() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const { fullName } = useRole()
  const [month, setMonth] = useState(format(startOfMonth(uaeNow()), 'yyyy-MM'))
  const [busy, setBusy] = useState(false)
  const supported = browserSupportsWebAuthn()

  const { data: rows = [], isLoading } = useQuery<AttendanceRow[]>({
    queryKey: ['attendance', 'me', month],
    queryFn: async () => {
      const { data } = await api.get('/api/attendance/me', { params: { month } })
      return data
    },
    staleTime: 10_000,
  })

  const { data: creds = [] } = useQuery<Credential[]>({
    queryKey: ['attendance', 'credentials'],
    queryFn: async () => {
      const { data } = await api.get('/api/attendance/credentials/me')
      return data
    },
  })

  const today = uaeNow().toISOString().slice(0, 10)
  const todayRow = useMemo(
    () => rows.find((r) => r.date === today),
    [rows, today],
  )

  const enrollMut = useMutation({
    mutationFn: async () => {
      setBusy(true)
      const { data: options } = await api.post('/api/attendance/enroll/options', {})
      const att = await startRegistration({ optionsJSON: options })
      const deviceLabel = `${navigator.platform} — ${navigator.userAgent.split(') ')[0].split(' (').pop() ?? 'browser'}`
      const { data } = await api.post('/api/attendance/enroll/verify', {
        response: att,
        deviceLabel,
      })
      return data
    },
    onSuccess: () => {
      toast.success('Biometric enrolled on this device')
      qc.invalidateQueries({ queryKey: ['attendance', 'credentials'] })
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Enrollment failed')
    },
    onSettled: () => setBusy(false),
  })

  const clockMut = useMutation({
    mutationFn: async (action: 'in' | 'out') => {
      setBusy(true)
      const { data: options } = await api.post('/api/attendance/clock/options', {})
      const auth = await startAuthentication({ optionsJSON: options })
      const { data } = await api.post('/api/attendance/clock/verify', {
        response: auth,
        action,
        userName: fullName ?? user?.email,
      })
      return data
    },
    onSuccess: (_, action) => {
      toast.success(action === 'in' ? 'Clocked in' : 'Clocked out')
      qc.invalidateQueries({ queryKey: ['attendance', 'me'] })
    },
    onError: async (e: any) => {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Failed'
      const code = e?.response?.data?.code
      if (code === 'NOT_ENROLLED') {
        toast.error('Enroll your biometric first')
      } else {
        toast.error(msg)
      }
    },
    onSettled: () => setBusy(false),
  })

  const removeCredMut = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/attendance/credentials/${encodeURIComponent(id)}`)
    },
    onSuccess: () => {
      toast.success('Device removed')
      qc.invalidateQueries({ queryKey: ['attendance', 'credentials'] })
    },
    onError: () => toast.error('Failed to remove'),
  })

  const totalHoursThisMonth = useMemo(() => {
    let ms = 0
    for (const r of rows) {
      if (r.clock_in && r.clock_out) {
        ms += new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()
      }
    }
    const h = Math.floor(ms / 3_600_000)
    const m = Math.floor((ms % 3_600_000) / 60_000)
    return `${h}h ${m}m`
  }, [rows])

  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title="Attendance" />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {!supported && (
          <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-4 font-body text-sm">
            This browser doesn't support fingerprint / Face ID. Use Safari or Chrome on a phone with biometrics enabled.
          </div>
        )}

        {/* Today status */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-5">
          <h2 className="font-display text-lg text-sheen-black mb-3">Today</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg bg-sheen-cream/40 p-3 text-center">
              <p className="font-body text-[10px] uppercase tracking-wide text-sheen-muted">Clock In</p>
              <p className="font-display text-lg font-bold text-sheen-black">
                {todayRow?.clock_in ? uaeDateLabel(todayRow.clock_in) : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-sheen-cream/40 p-3 text-center">
              <p className="font-body text-[10px] uppercase tracking-wide text-sheen-muted">Clock Out</p>
              <p className="font-display text-lg font-bold text-sheen-black">
                {todayRow?.clock_out ? uaeDateLabel(todayRow.clock_out) : '—'}
              </p>
            </div>
            <div className="rounded-lg bg-sheen-cream/40 p-3 text-center">
              <p className="font-body text-[10px] uppercase tracking-wide text-sheen-muted">Hours</p>
              <p className="font-display text-lg font-bold text-sheen-brown">
                {calcHours(todayRow?.clock_in ?? null, todayRow?.clock_out ?? null)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={busy || !!todayRow?.clock_in || !supported}
              onClick={() => clockMut.mutate('in')}
              className="py-4 rounded-xl bg-green-600 text-white font-body font-semibold text-base hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Clock In
            </button>
            <button
              disabled={busy || !todayRow?.clock_in || !!todayRow?.clock_out || !supported}
              onClick={() => clockMut.mutate('out')}
              className="py-4 rounded-xl bg-red-600 text-white font-body font-semibold text-base hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Clock Out
            </button>
          </div>
        </div>

        {/* Enrolled devices */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg text-sheen-black">Biometric Devices</h2>
            <button
              disabled={busy || !supported}
              onClick={() => enrollMut.mutate()}
              className="px-4 py-2 rounded-lg bg-sheen-brown text-white font-body text-xs font-semibold hover:bg-sheen-brown/90 disabled:opacity-40"
            >
              Enroll This Device
            </button>
          </div>
          {creds.length === 0 ? (
            <p className="font-body text-sm text-sheen-muted">
              No device enrolled yet. Tap <strong>Enroll This Device</strong> and confirm with Face ID / fingerprint.
            </p>
          ) : (
            <ul className="space-y-2">
              {creds.map((c) => (
                <li key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-sheen-cream/30 font-body text-sm">
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="font-medium text-sheen-black truncate">
                      {c.device_label ?? 'Unknown device'}
                    </p>
                    <p className="text-xs text-sheen-muted">
                      Enrolled {format(parseISO(c.created_at), 'MMM d, yyyy')}
                      {c.last_used_at && ` · Last used ${format(parseISO(c.last_used_at), 'MMM d, HH:mm')}`}
                    </p>
                  </div>
                  <button
                    onClick={() => removeCredMut.mutate(c.id)}
                    className="text-xs font-semibold text-red-600 hover:text-red-700 px-2 py-1 rounded shrink-0"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Monthly history */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="font-display text-lg text-sheen-black">Month History</h2>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={month}
                max={format(uaeNow(), 'yyyy-MM')}
                onChange={(e) => setMonth(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-sheen-muted/30 font-body text-xs bg-sheen-cream"
              />
              <span className="font-body text-xs text-sheen-muted">Total: <strong>{totalHoursThisMonth}</strong></span>
            </div>
          </div>

          {isLoading ? (
            <p className="font-body text-sm text-sheen-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="font-body text-sm text-sheen-muted">No attendance records this month.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full font-body text-sm">
                <thead>
                  <tr className="border-b border-sheen-cream text-xs text-sheen-muted uppercase tracking-wide">
                    <th className="text-left py-2">Date</th>
                    <th className="text-left py-2">In</th>
                    <th className="text-left py-2">Out</th>
                    <th className="text-right py-2">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-sheen-cream/50">
                      <td className="py-2 text-sheen-black">
                        {format(parseISO(r.date), 'EEE, MMM d')}
                      </td>
                      <td className="py-2 text-sheen-black">{r.clock_in ? uaeDateLabel(r.clock_in) : '—'}</td>
                      <td className="py-2 text-sheen-black">{r.clock_out ? uaeDateLabel(r.clock_out) : '—'}</td>
                      <td className="py-2 text-right text-sheen-brown font-semibold">
                        {calcHours(r.clock_in, r.clock_out)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
