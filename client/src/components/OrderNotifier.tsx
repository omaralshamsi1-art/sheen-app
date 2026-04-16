import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getOrders } from '../services/orderService'
import { useRole } from '../hooks/useRole'
import { useLanguage } from '../i18n/LanguageContext'
import toast from 'react-hot-toast'
import type { Order } from '../types'

// ── Audio engine — uses HTML5 Audio for Safari/iOS compatibility ──

let audioUnlocked = false
let notificationAudio: HTMLAudioElement | null = null

// Generate a WAV notification chime programmatically
function generateNotificationWAV(): string {
  const sampleRate = 22050
  const duration = 0.7
  const numSamples = Math.floor(sampleRate * duration)
  const buffer = new Float32Array(numSamples)

  // Three ascending tones (A5, D6, E6) for a pleasant chime
  const tones = [
    { freq: 880, start: 0, end: 0.25, vol: 0.4 },
    { freq: 1175, start: 0.12, end: 0.4, vol: 0.4 },
    { freq: 1318, start: 0.25, end: 0.65, vol: 0.35 },
  ]

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    let sample = 0
    for (const tone of tones) {
      if (t >= tone.start && t < tone.end) {
        const progress = (t - tone.start) / (tone.end - tone.start)
        const envelope = Math.exp(-progress * 4) // decay
        sample += Math.sin(2 * Math.PI * tone.freq * t) * tone.vol * envelope
      }
    }
    buffer[i] = Math.max(-1, Math.min(1, sample))
  }

  // Encode as 16-bit WAV
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = numSamples * blockAlign
  const headerSize = 44
  const wav = new ArrayBuffer(headerSize + dataSize)
  const view = new DataView(wav)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]))
    view.setInt16(headerSize + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
  }

  // Convert to base64 data URL
  const bytes = new Uint8Array(wav)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return 'data:audio/wav;base64,' + btoa(binary)
}

// Create the WAV data URL once
const wavDataUrl = typeof window !== 'undefined' ? generateNotificationWAV() : ''

// Single persistent Audio element — Safari needs the SAME element reused
if (typeof window !== 'undefined') {
  notificationAudio = new Audio(wavDataUrl)
  notificationAudio.volume = 0.8
  // Preload so it's ready instantly
  notificationAudio.load()
}

/** Must be called from a direct user tap/click handler on Safari */
export async function unlockAndTestAudio(): Promise<boolean> {
  try {
    if (!notificationAudio) {
      notificationAudio = new Audio(wavDataUrl)
      notificationAudio.volume = 0.8
    }
    // Play from user gesture — this permanently unlocks this Audio element on Safari
    notificationAudio.currentTime = 0
    await notificationAudio.play()
    audioUnlocked = true

    // Also keep it warm with a silent loop that Safari won't suspend
    // This creates a tiny silent audio context that keeps the audio pipeline active
    try {
      const ctx = new AudioContext()
      await ctx.resume()
      const silentOsc = ctx.createOscillator()
      const silentGain = ctx.createGain()
      silentGain.gain.setValueAtTime(0, ctx.currentTime)
      silentOsc.connect(silentGain).connect(ctx.destination)
      silentOsc.start()
      // Keep it running — don't stop or close
    } catch { /* ok */ }

    return true
  } catch {
    return false
  }
}

export function playNotificationSound() {
  if (!audioUnlocked || !notificationAudio) return
  try {
    // Reuse the SAME Audio element — Safari only allows play() on elements
    // that were previously played from a user gesture
    notificationAudio.currentTime = 0
    notificationAudio.play().catch(() => {})
  } catch {
    // silent fallback
  }
}

// NOTE: No global auto-unlock — it must only happen for staff/admin
// via the banner tap or the test sound button on the Orders page.

const SOUND_PREF_KEY = 'sheen-sound-enabled'

/**
 * Global order notifier — mount once in AppLayout.
 * Polls pending orders every 10s and plays sound when new ones arrive.
 *
 * Sound auto-unlock strategy:
 * - First visit: shows a banner; user taps it once → saved to localStorage.
 * - Every subsequent reload: a one-time document click/tap listener silently
 *   unlocks audio using that first interaction. The banner never shows again.
 *   (Browsers require at least one user gesture before allowing audio.)
 */
export default function OrderNotifier() {
  const { role } = useRole()
  const { t } = useLanguage()
  const [soundReady, setSoundReady] = useState(audioUnlocked)
  const prevIdsRef = useRef<Set<string>>(new Set())
  const initialRef = useRef(true)

  const isStaffOrAdmin = role === 'admin' || role === 'staff'
  const previouslyEnabled = typeof localStorage !== 'undefined' && localStorage.getItem(SOUND_PREF_KEY) === 'true'

  const { data: pending = [] } = useQuery({
    queryKey: ['orders', 'pending-global'],
    queryFn: () => getOrders({ status: 'pending' }),
    refetchInterval: 10000,
    enabled: isStaffOrAdmin,
  })

  // Auto-unlock: if user previously enabled sound, silently unlock on first tap/click anywhere
  useEffect(() => {
    if (!isStaffOrAdmin || audioUnlocked || !previouslyEnabled) return

    const autoUnlock = async () => {
      // Silently unlock — mute, play, restore volume. No audible chime on reload.
      if (notificationAudio) {
        const origVol = notificationAudio.volume
        notificationAudio.volume = 0
        try {
          notificationAudio.currentTime = 0
          await notificationAudio.play()
          audioUnlocked = true
          setSoundReady(true)
        } catch { /* ok */ }
        notificationAudio.volume = origVol
      }
      document.removeEventListener('click', autoUnlock, true)
      document.removeEventListener('touchstart', autoUnlock, true)
    }

    document.addEventListener('click', autoUnlock, { capture: true, once: true })
    document.addEventListener('touchstart', autoUnlock, { capture: true, once: true })

    return () => {
      document.removeEventListener('click', autoUnlock, true)
      document.removeEventListener('touchstart', autoUnlock, true)
    }
  }, [isStaffOrAdmin, previouslyEnabled])

  // Check if audio got unlocked
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

  // Banner only shows if user has NEVER enabled sound before
  if (!isStaffOrAdmin || soundReady || previouslyEnabled) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-bounce">
      <button
        onClick={async () => {
          const ok = await unlockAndTestAudio()
          if (ok) {
            setSoundReady(true)
            localStorage.setItem(SOUND_PREF_KEY, 'true')
            playNotificationSound()
            toast.success(t('soundEnabled'))
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
