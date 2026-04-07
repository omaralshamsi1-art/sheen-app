import { useState, useRef, useEffect } from 'react'
import api from '../lib/api'
import { useLanguage } from '../i18n/LanguageContext'

interface StickerMessage {
  id: string
  message_ar: string
  message_en: string
}

interface StickerPrintProps {
  customerName?: string
  onClose: () => void
}

export default function StickerPrint({ customerName, onClose }: StickerPrintProps) {
  const { t } = useLanguage()
  const [sticker, setSticker] = useState<StickerMessage | null>(null)
  const [, setLoading] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)

  const fetchRandom = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/stickers/random')
      setSticker(data)
    } catch {
      setSticker({ id: '', message_ar: 'شكراً لزيارتك ☕', message_en: 'Thank you for visiting' })
    }
    setLoading(false)
  }

  useEffect(() => { fetchRandom() }, [])

  const handlePrint = () => {
    if (!sticker) return
    const content = printRef.current
    if (!content) return

    const printWindow = window.open('', '_blank', 'width=400,height=300')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="utf-8" />
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fff; }
          .sticker {
            width: 280px;
            padding: 24px 20px;
            text-align: center;
            border: 2px dashed #D4A843;
            border-radius: 16px;
          }
          .logo { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 700; color: #D4A843; letter-spacing: 2px; margin-bottom: 12px; }
          .message-ar { font-family: 'DM Sans', sans-serif; font-size: 16px; line-height: 1.6; color: #1A1A1A; margin-bottom: 8px; direction: rtl; }
          .message-en { font-family: 'DM Sans', sans-serif; font-size: 11px; color: #A0785A; direction: ltr; margin-bottom: 12px; }
          .name { font-family: 'DM Sans', sans-serif; font-size: 12px; color: #8B4513; font-weight: 600; margin-bottom: 8px; }
          .social { font-family: 'DM Sans', sans-serif; font-size: 10px; color: #A0785A; }
          @media print { body { min-height: auto; } .sticker { border: 2px dashed #D4A843; } }
        </style>
      </head>
      <body>
        <div class="sticker">
          <div class="logo">SHEEN</div>
          ${customerName ? `<div class="name">${customerName}</div>` : ''}
          <div class="message-ar">${sticker?.message_ar ?? ''}</div>
          <div class="message-en">${sticker?.message_en ?? ''}</div>
          <div class="social">@SheenCafe</div>
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => { printWindow.print() }, 300)
  }

  const shuffle = () => fetchRandom()

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Preview */}
        <div ref={printRef} className="p-6 text-center">
          <div className="border-2 border-dashed border-sheen-gold rounded-2xl p-6">
            <h2 className="font-display text-3xl font-bold text-sheen-gold tracking-wider mb-3">SHEEN</h2>
            {customerName && (
              <p className="font-body text-sm text-sheen-brown font-semibold mb-2">{customerName}</p>
            )}
            <p className="font-body text-lg text-sheen-black leading-relaxed mb-2" dir="rtl">{sticker?.message_ar}</p>
            <p className="font-body text-xs text-sheen-muted" dir="ltr">{sticker?.message_en}</p>
            <p className="font-body text-[10px] text-sheen-muted mt-3">@SheenCafe</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-2">
          <button
            onClick={shuffle}
            className="flex-1 px-4 py-2.5 rounded-lg bg-sheen-cream text-sheen-brown font-body text-sm font-medium hover:bg-sheen-gold/20 transition-colors"
          >
            {t('shuffle')}
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 px-4 py-2.5 rounded-lg bg-sheen-brown text-white font-body text-sm font-medium hover:bg-sheen-brown/90 transition-colors"
          >
            {t('printSticker')}
          </button>
        </div>
      </div>
    </div>
  )
}
