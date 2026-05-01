import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import api from '../lib/api'
import TopBar from '../components/layout/TopBar'

interface AttendanceRow {
  id: string
  user_id: string
  user_email: string
  user_name: string | null
  date: string
  clock_in: string | null
  clock_out: string | null
}

function uaeNow() {
  const d = new Date()
  d.setHours(d.getHours() + 4)
  return d
}

function uaeTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  d.setHours(d.getHours() + 4)
  return d.toISOString().slice(11, 16)
}

function calcHours(inIso: string | null, outIso: string | null): { label: string; ms: number } {
  if (!inIso || !outIso) return { label: '—', ms: 0 }
  const ms = new Date(outIso).getTime() - new Date(inIso).getTime()
  if (ms <= 0) return { label: '—', ms: 0 }
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return { label: `${h}h ${m}m`, ms }
}

export default function AttendanceAdmin() {
  const [month, setMonth] = useState(format(uaeNow(), 'yyyy-MM'))
  const [staffFilter, setStaffFilter] = useState<string>('all')

  const { data: rows = [], isLoading } = useQuery<AttendanceRow[]>({
    queryKey: ['attendance', 'admin', month],
    queryFn: async () => {
      const { data } = await api.get('/api/attendance/admin', { params: { month } })
      return data
    },
    staleTime: 10_000,
  })

  const staffList = useMemo(() => {
    const set = new Map<string, string>()
    for (const r of rows) {
      if (!set.has(r.user_email)) set.set(r.user_email, r.user_name || r.user_email)
    }
    return Array.from(set.entries()).map(([email, name]) => ({ email, name }))
  }, [rows])

  const filtered = useMemo(
    () => (staffFilter === 'all' ? rows : rows.filter((r) => r.user_email === staffFilter)),
    [rows, staffFilter],
  )

  const perStaff = useMemo(() => {
    const map: Record<string, { name: string; days: number; ms: number }> = {}
    for (const r of filtered) {
      if (!map[r.user_email]) {
        map[r.user_email] = { name: r.user_name || r.user_email, days: 0, ms: 0 }
      }
      if (r.clock_in && r.clock_out) {
        map[r.user_email].days += 1
        map[r.user_email].ms += new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()
      }
    }
    return Object.entries(map).map(([email, d]) => ({
      email,
      name: d.name,
      days: d.days,
      hours: `${Math.floor(d.ms / 3_600_000)}h ${Math.floor((d.ms % 3_600_000) / 60_000)}m`,
    }))
  }, [filtered])

  const exportCsv = () => {
    const header = ['Date', 'Staff', 'Email', 'Clock In', 'Clock Out', 'Hours']
    const lines = [header.join(',')]
    for (const r of filtered) {
      const { label } = calcHours(r.clock_in, r.clock_out)
      lines.push(
        [
          r.date,
          `"${(r.user_name || '').replace(/"/g, '""')}"`,
          r.user_email,
          uaeTime(r.clock_in),
          uaeTime(r.clock_out),
          label,
        ].join(','),
      )
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance_${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title="Attendance — Admin" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Filters */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-4 flex flex-wrap items-center gap-3">
          <input
            type="month"
            value={month}
            max={format(uaeNow(), 'yyyy-MM')}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-sheen-muted/30 font-body text-xs bg-sheen-cream"
          />
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-sheen-muted/30 font-body text-xs bg-sheen-cream"
          >
            <option value="all">All Staff</option>
            {staffList.map((s) => (
              <option key={s.email} value={s.email}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="ml-auto px-4 py-2 rounded-lg bg-sheen-brown text-white font-body text-xs font-semibold hover:bg-sheen-brown/90 disabled:opacity-40"
          >
            Export CSV
          </button>
        </div>

        {/* Per-staff summary */}
        {perStaff.length > 0 && (
          <div className="bg-sheen-white rounded-xl shadow-sm p-5">
            <h2 className="font-display text-lg text-sheen-black mb-3">Summary — {format(parseISO(month + '-01'), 'MMMM yyyy')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {perStaff.map((s) => (
                <div key={s.email} className="rounded-lg bg-sheen-cream/40 p-3">
                  <p className="font-body text-sm font-semibold text-sheen-black truncate">{s.name}</p>
                  <p className="font-body text-xs text-sheen-muted truncate">{s.email}</p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-sheen-muted">{s.days} days</span>
                    <span className="font-display font-bold text-sheen-brown">{s.hours}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daily rows */}
        <div className="bg-sheen-white rounded-xl shadow-sm p-5">
          <h2 className="font-display text-lg text-sheen-black mb-3">Daily Records</h2>
          {isLoading ? (
            <p className="font-body text-sm text-sheen-muted">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="font-body text-sm text-sheen-muted">No attendance records for this month.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full font-body text-sm">
                <thead>
                  <tr className="border-b border-sheen-cream text-xs text-sheen-muted uppercase tracking-wide">
                    <th className="text-left py-2">Date</th>
                    <th className="text-left py-2">Staff</th>
                    <th className="text-left py-2">In</th>
                    <th className="text-left py-2">Out</th>
                    <th className="text-right py-2">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-sheen-cream/50">
                      <td className="py-2 text-sheen-black whitespace-nowrap">
                        {format(parseISO(r.date), 'EEE, MMM d')}
                      </td>
                      <td className="py-2 text-sheen-black">
                        <p className="font-medium">{r.user_name || r.user_email}</p>
                        {r.user_name && (
                          <p className="text-[10px] text-sheen-muted">{r.user_email}</p>
                        )}
                      </td>
                      <td className="py-2 text-sheen-black">{uaeTime(r.clock_in)}</td>
                      <td className="py-2 text-sheen-black">{uaeTime(r.clock_out)}</td>
                      <td className="py-2 text-right text-sheen-brown font-semibold">
                        {calcHours(r.clock_in, r.clock_out).label}
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
