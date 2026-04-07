import { useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getOrders } from '../services/orderService'
import { useRole } from '../hooks/useRole'
import { useLanguage } from '../i18n/LanguageContext'
import toast from 'react-hot-toast'
import type { Order } from '../types'

// Shared AudioContext — unlocked on first user interaction
let sharedAudioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioContext()
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume()
  }
  return sharedAudioCtx
}

function unlockAudio() {
  try { getAudioCtx() } catch { /* ignore */ }
}
if (typeof window !== 'undefined') {
  window.addEventListener('click', unlockAudio, { once: true })
  window.addEventListener('touchstart', unlockAudio, { once: true })
}

export function playNotificationSound() {
  try {
    const ctx = getAudioCtx()
    const now = ctx.currentTime

    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(880, now)
    gain1.gain.setValueAtTime(0.4, now)
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
    osc1.connect(gain1).connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.3)

    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1175, now + 0.15)
    gain2.gain.setValueAtTime(0, now)
    gain2.gain.setValueAtTime(0.4, now + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5)
    osc2.connect(gain2).connect(ctx.destination)
    osc2.start(now + 0.15)
    osc2.stop(now + 0.5)

    const osc3 = ctx.createOscillator()
    const gain3 = ctx.createGain()
    osc3.type = 'sine'
    osc3.frequency.setValueAtTime(1318, now + 0.3)
    gain3.gain.setValueAtTime(0, now)
    gain3.gain.setValueAtTime(0.35, now + 0.3)
    gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.7)
    osc3.connect(gain3).connect(ctx.destination)
    osc3.start(now + 0.3)
    osc3.stop(now + 0.7)
  } catch {
    // silent fallback
  }
}

/**
 * Global order notifier — mount once in AppLayout.
 * Polls pending orders every 10s and plays sound when new ones arrive.
 * Only active for admin and staff roles.
 */
export default function OrderNotifier() {
  const { role } = useRole()
  const { t } = useLanguage()
  const prevIdsRef = useRef<Set<string>>(new Set())
  const initialRef = useRef(true)

  const isStaffOrAdmin = role === 'admin' || role === 'staff'

  const { data: pending = [] } = useQuery({
    queryKey: ['orders', 'pending-global'],
    queryFn: () => getOrders({ status: 'pending' }),
    refetchInterval: 10000,
    enabled: isStaffOrAdmin,
  })

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

  // This component renders nothing — it just runs the polling logic
  return null
}
