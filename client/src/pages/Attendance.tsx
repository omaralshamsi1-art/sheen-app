import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import TopBar from '../components/layout/TopBar'
import toast from 'react-hot-toast'

interface Staff {
  user_id: string
  email: string
  full_name: string | null
  role: 'admin' | 'staff'
  photo_url: string | null
  has_pin: boolean
}

interface TodayRow {
  user_id: string
  user_name: string | null
  user_email: string
  date: string
  clock_in: string | null
  clock_out: string | null
}

function uaeNow() {
  const d = new Date()
  d.setHours(d.getHours() + 4)
  return d
}

function uaeTime(iso: string) {
  const d = new Date(iso)
  d.setHours(d.getHours() + 4)
  return d.toISOString().slice(11, 16)
}

export default function Attendance() {
  const qc = useQueryClient()
  const localToken = typeof window !== 'undefined' ? localStorage.getItem('sheen_kiosk_token') : null

  // Verify kiosk token validity with server
  const { data: kioskCheck, isLoading: checking } = useQuery({
    queryKey: ['kiosk-check'],
    queryFn: async () => {
      if (!localToken) return { ok: false }
      const { data } = await api.get('/api/attendance/kiosk/check')
      return data as { ok: boolean }
    },
    retry: false,
    staleTime: 5 * 60_000,
  })

  const isKiosk = !!localToken && kioskCheck?.ok === true

  const { data: staff = [] } = useQuery<Staff[]>({
    queryKey: ['kiosk-staff'],
    queryFn: async () => {
      const { data } = await api.get('/api/attendance/kiosk/staff')
      return data
    },
    enabled: isKiosk,
    refetchInterval: 30_000,
  })

  const { data: todayRows = [] } = useQuery<TodayRow[]>({
    queryKey: ['kiosk-today', uaeNow().toISOString().slice(0, 7)],
    queryFn: async () => {
      const month = uaeNow().toISOString().slice(0, 7)
      const { data } = await api.get('/api/attendance/admin', { params: { month } })
      const today = uaeNow().toISOString().slice(0, 10)
      return (data as TodayRow[]).filter((r) => r.date === today)
    },
    enabled: isKiosk,
    refetchInterval: 30_000,
  })

  const todayMap: Record<string, TodayRow> = {}
  for (const r of todayRows) todayMap[r.user_id] = r

  const [selected, setSelected] = useState<Staff | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [step, setStep] = useState<'pin' | 'selfie' | 'submitting'>('pin')
  const [selfie, setSelfie] = useState<string | null>(null)
  const [action, setAction] = useState<'in' | 'out'>('in')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // ─── Camera ────────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch (e: any) {
      toast.error('Cannot access camera: ' + e.message)
    }
  }
  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }
  useEffect(() => () => stopCamera(), [])

  const captureSelfie = (): string | null => {
    const video = videoRef.current
    if (!video) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.7)
  }

  const close = () => {
    setSelected(null)
    setPinInput('')
    setSelfie(null)
    setStep('pin')
    stopCamera()
  }

  const clockMut = useMutation({
    mutationFn: async () => {
      if (!selected) return
      setStep('submitting')
      const { data } = await api.post('/api/attendance/kiosk/clock', {
        user_id: selected.user_id,
        pin: pinInput,
        action,
        selfie,
      })
      return data
    },
    onSuccess: (d: any) => {
      const t = uaeTime(d.time)
      toast.success(
        `${d.name}: ${action === 'in' ? 'Clocked in' : 'Clocked out'} at ${t}`,
        { duration: 4000 },
      )
      qc.invalidateQueries({ queryKey: ['kiosk-today'] })
      close()
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message ?? 'Failed'
      toast.error(msg, { duration: 4500 })
      setStep('pin')
    },
  })

  const openStaff = (s: Staff, act: 'in' | 'out') => {
    if (!s.has_pin) {
      toast.error(`${s.full_name ?? s.email} has no PIN. Ask admin to set one.`)
      return
    }
    setSelected(s)
    setAction(act)
    setPinInput('')
    setSelfie(null)
    setStep('pin')
  }

  const submitPin = () => {
    if (!/^\d{4,8}$/.test(pinInput)) {
      toast.error('Enter your 4–8 digit PIN')
      return
    }
    if (selected?.photo_url) {
      setStep('selfie')
      void startCamera()
    } else {
      // No reference photo on file — skip face check
      clockMut.mutate()
    }
  }

  const submitSelfie = () => {
    const img = captureSelfie()
    if (!img) {
      toast.error('Could not capture selfie')
      return
    }
    setSelfie(img)
    stopCamera()
    setTimeout(() => clockMut.mutate(), 50)
  }

  // ─── Not a kiosk: block ─────────────────────────────────────────────
  if (checking) {
    return (
      <div className="min-h-screen bg-sheen-cream">
        <TopBar title="Attendance" />
        <main className="p-6 text-center font-body text-sm text-sheen-muted">Checking device…</main>
      </div>
    )
  }
  if (!isKiosk) {
    return (
      <div className="min-h-screen bg-sheen-cream">
        <TopBar title="Attendance" />
        <main className="max-w-md mx-auto p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-5">
            <p className="font-display text-lg font-semibold text-amber-900 mb-2">
              This device is not a registered kiosk
            </p>
            <p className="font-body text-sm text-amber-800 mb-3">
              Attendance can only be recorded on the shop kiosk. Personal phones cannot clock in.
            </p>
            <p className="font-body text-xs text-amber-700">
              Admin: register the shop iPad in <Link to="/settings" className="underline font-semibold">Settings → Attendance Kiosk</Link>.
            </p>
          </div>
          <div className="text-center">
            <Link to="/attendance/admin" className="font-body text-sm text-sheen-gold hover:text-sheen-brown underline">
              View attendance reports →
            </Link>
          </div>
        </main>
      </div>
    )
  }

  // ─── Kiosk grid ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-sheen-cream">
      <TopBar title="Time Attendance" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="bg-sheen-white rounded-xl shadow-sm p-4 text-center">
          <p className="font-display text-2xl font-bold text-sheen-black">
            {format(uaeNow(), 'EEEE, MMMM d, yyyy')} · {format(uaeNow(), 'HH:mm')}
          </p>
          <p className="font-body text-xs text-sheen-muted mt-1">
            Tap your name to clock in or out
          </p>
        </div>

        {staff.length === 0 ? (
          <p className="text-center font-body text-sm text-sheen-muted">No staff with PINs configured yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {staff.map((s) => {
              const today = todayMap[s.user_id]
              const inTime = today?.clock_in ? uaeTime(today.clock_in) : null
              const outTime = today?.clock_out ? uaeTime(today.clock_out) : null
              const status = !inTime ? 'pending' : !outTime ? 'in' : 'done'
              return (
                <div
                  key={s.user_id}
                  className="bg-sheen-white rounded-2xl shadow-sm p-4 flex flex-col items-center text-center"
                >
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-sheen-cream border-4 border-sheen-cream/60 mb-3 flex items-center justify-center">
                    {s.photo_url ? (
                      <img src={s.photo_url} alt={s.email} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-display text-3xl text-sheen-muted">
                        {(s.full_name ?? s.email).slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="font-body font-semibold text-sheen-black truncate w-full">
                    {s.full_name ?? s.email.split('@')[0]}
                  </p>
                  <p className="font-body text-[10px] uppercase tracking-wide text-sheen-muted mb-2">
                    {s.role}
                  </p>

                  {status === 'done' ? (
                    <div className="w-full text-center">
                      <p className="font-body text-xs text-sheen-muted">In {inTime} · Out {outTime}</p>
                      <p className="font-body text-xs text-green-700 font-semibold mt-1">Done for today</p>
                    </div>
                  ) : status === 'in' ? (
                    <div className="w-full">
                      <p className="font-body text-xs text-sheen-muted">In: {inTime}</p>
                      <button
                        disabled={!s.has_pin}
                        onClick={() => openStaff(s, 'out')}
                        className="mt-2 w-full py-2 rounded-lg bg-red-600 text-white font-body font-semibold text-sm hover:bg-red-700 disabled:opacity-40"
                      >
                        Clock Out
                      </button>
                    </div>
                  ) : (
                    <button
                      disabled={!s.has_pin}
                      onClick={() => openStaff(s, 'in')}
                      className="w-full py-2 rounded-lg bg-green-600 text-white font-body font-semibold text-sm hover:bg-green-700 disabled:opacity-40"
                    >
                      Clock In
                    </button>
                  )}
                  {!s.has_pin && (
                    <p className="font-body text-[10px] text-amber-600 mt-1">No PIN set</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* PIN + Selfie modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={close}>
          <div
            className="bg-sheen-white w-full max-w-md rounded-2xl shadow-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-sheen-cream flex items-center justify-center shrink-0">
                {selected.photo_url ? (
                  <img src={selected.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display text-xl text-sheen-muted">
                    {(selected.full_name ?? selected.email).slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-lg text-sheen-black truncate">
                  {selected.full_name ?? selected.email}
                </p>
                <p className="font-body text-xs text-sheen-muted">
                  {action === 'in' ? 'Clock In' : 'Clock Out'}
                </p>
              </div>
              <button onClick={close} className="p-1.5 rounded-full hover:bg-sheen-cream" aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18" /><path d="M6 6L18 18" />
                </svg>
              </button>
            </div>

            {step === 'pin' && (
              <div>
                <label className="block font-body text-xs uppercase tracking-wide text-sheen-muted mb-2">
                  Enter your PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  maxLength={8}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && submitPin()}
                  className="w-full text-center font-display text-3xl tracking-[0.5em] py-4 rounded-xl border-2 border-sheen-muted/30 focus:outline-none focus:border-sheen-gold"
                  placeholder="• • • •"
                />
                <button
                  onClick={submitPin}
                  className="mt-4 w-full py-3 rounded-xl bg-sheen-brown text-white font-body font-semibold hover:bg-sheen-brown/90"
                >
                  Continue →
                </button>
              </div>
            )}

            {step === 'selfie' && (
              <div>
                <p className="font-body text-sm text-sheen-muted text-center mb-3">
                  Look at the camera and tap Capture
                </p>
                <div className="aspect-[4/3] bg-sheen-black rounded-xl overflow-hidden mb-3">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                </div>
                <button
                  onClick={submitSelfie}
                  className="w-full py-3 rounded-xl bg-green-600 text-white font-body font-semibold hover:bg-green-700"
                >
                  📸 Capture & {action === 'in' ? 'Clock In' : 'Clock Out'}
                </button>
              </div>
            )}

            {step === 'submitting' && (
              <div className="py-8 text-center">
                <div className="inline-block animate-spin w-10 h-10 border-4 border-sheen-gold border-t-transparent rounded-full mb-3" />
                <p className="font-body text-sm text-sheen-muted">Verifying…</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
