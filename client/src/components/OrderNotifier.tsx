import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getOrders } from '../services/orderService'
import { useRole } from '../hooks/useRole'
import { useLanguage } from '../i18n/LanguageContext'
import toast from 'react-hot-toast'
import type { Order } from '../types'

// ── Audio engine ──
let sharedAudioCtx: AudioContext | null = null
let audioUnlocked = false

function getAudioCtx(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioContext()
  }
  return sharedAudioCtx
}

/** Must be called from a direct user tap/click handler */
export async function unlockAndTestAudio(): Promise<boolean> {
  try {
    const ctx = getAudioCtx()
    // Resume is the critical call that iOS requires inside a user gesture
    await ctx.resume()
    // Play a short silent tone to fully unlock the audio pipeline
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, ctx.currentTime)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.01)
    audioUnlocked = true
    return true
  } catch {
    return false
  }
}

export function playNotificationSound() {
  if (!audioUnlocked) return

  try {
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime

    const play = (freq: number, start: number, end: number, vol: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + start)
      gain.gain.setValueAtTime(0, now)
      gain.gain.setValueAtTime(vol, now + start)
      gain.gain.exponentialRampToValueAtTime(0.01, now + end)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + start)
      osc.stop(now + end)
    }

    play(880, 0, 0.3, 0.4)
    play(1175, 0.15, 0.5, 0.4)
    play(1318, 0.3, 0.7, 0.35)
  } catch {
    // silent fallback
  }
}

// Try auto-unlock on desktop (works on Chrome/Firefox, not iOS)
if (typeof window !== 'undefined') {
  const tryUnlock = () => { unlockAndTestAudio() }
  window.addEventListener('click', tryUnlock, { once: true })
  window.addEventListener('touchstart', tryUnlock, { once: true })
}

/**
 * Global order notifier — mount once in AppLayout.
 * Polls pending orders every 10s and plays sound when new ones arrive.
 * Shows an "Enable Sound" banner on iPad/mobile until tapped.
 */
export default function OrderNotifier() {
  const { role } = useRole()
  const { t } = useLanguage()
  const [soundReady, setSoundReady] = useState(audioUnlocked)
  const [dismissed, setDismissed] = useState(false)
  const prevIdsRef = useRef<Set<string>>(new Set())
  const initialRef = useRef(true)

  const isStaffOrAdmin = role === 'admin' || role === 'staff'

  const { data: pending = [] } = useQuery({
    queryKey: ['orders', 'pending-global'],
    queryFn: () => getOrders({ status: 'pending' }),
    refetchInterval: 10000,
    enabled: isStaffOrAdmin,
  })

  // Check if audio got unlocked by the global listeners
  useEffect(() => {
    if (audioUnlocked) setSoundReady(true)
    const interval = setInterval(() => {
      if (audioUnlocked && !soundReady) setSoundReady(true)
    }, 2000)
    return () => clearInterval(interval)
  }, [soundReady])

  // Detect new orders
  useEffect(() => {
    if (!isStaffOrAdmin) return

    const currentIds = new Set(pending.map((o: Order) => o.id))

    if (initialRef.current) {
      prevIdsRef.current = currentIds
      initialRef.current = false
      return
    }

    let hasNew = false
    for (const id of currentIds) {
      if (!prevIdsRef.current.has(id)) {
        hasNew = true
        break
      }
    }

    if (hasNew) {
      playNotificationSound()
      toast(t('newOrderReceived'), { icon: '\u{1F514}', duration: 4000 })
    }

    prevIdsRef.current = currentIds
  }, [pending, isStaffOrAdmin, t])

  // Show "Enable Sound" banner for staff/admin if audio isn't unlocked
  if (!isStaffOrAdmin || soundReady || dismissed) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-bounce">
      <button
        onClick={async () => {
          const ok = await unlockAndTestAudio()
          if (ok) {
            setSoundReady(true)
            playNotificationSound()
            toast.success(t('soundEnabled'))
          } else {
            setDismissed(true)
          }
        }}
        className="flex items-center gap-2 bg-sheen-brown text-white px-5 py-3 rounded-full shadow-lg font-body text-sm font-medium"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
        {t('tapToEnableSound')}
      </button>
    </div>
  )
}
