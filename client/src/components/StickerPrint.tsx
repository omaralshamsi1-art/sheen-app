import { useState, useEffect } from 'react'
import api from '../lib/api'
import { useLanguage } from '../i18n/LanguageContext'

interface StickerMessage {
  id: string
  message_ar: string
  message_en: string
}

// SK 20 label sizes (width x height in mm)
const LABEL_SIZES = [
  { label: '50 × 30 mm', w: 50, h: 30 },
  { label: '50 × 40 mm', w: 50, h: 40 },
  { label: '40 × 30 mm', w: 40, h: 30 },
  { label: '60 × 40 mm', w: 60, h: 40 },
] as const

interface StickerPrintProps {
  customerName?: string
  onClose: () => void
}

export default function StickerPrint({ customerName, onClose }: StickerPrintProps) {
  const { t } = useLanguage()
  const [sticker, setSticker] = useState<StickerMessage | null>(null)
  const [labelIdx, setLabelIdx] = useState(() => {
    const saved = localStorage.getItem('sheen-label-size')
    return saved ? Number(saved) : 0
  })

  const label = LABEL_SIZES[labelIdx]

  const fetchRandom = async () => {
    try {
      const { data } = await api.get('/api/stickers/random')
      setSticker(data)
    } catch {
      setSticker({ id: '', message_ar: '\u0634\u0643\u0631\u0627\u064B \u0644\u0632\u064A\u0627\u0631\u062A\u0643 \u2615', message_en: 'Thank you for visiting' })
    }
  }

  useEffect(() => { fetchRandom() }, [])

  const changeLabelSize = (idx: number) => {
    setLabelIdx(idx)
    localStorage.setItem('sheen-label-size', String(idx))
  }

  const handlePrint = () => {
    if (!sticker) return

    // Scale font sizes based on label width
    const scale = label.w / 50 // normalize to 50mm base
    const logoSize = Math.round(14 * scale)
    const arSize = Math.round(9 * scale)
    const enSize = Math.round(6 * scale)
    const nameSize = Math.round(7 * scale)
    const socialSize = Math.round(5.5 * scale)

    const printWindow = window.open('', '_blank', 'width=400,height=400')
    if (!printWindow) return

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page {
    size: ${label.w}mm ${label.h}mm;
    margin: 0;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${label.w}mm;
    height: ${label.h}mm;
    overflow: hidden;
  }
  body {
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: Arial, Helvetica, sans-serif;
  }
  .label {
    width: ${label.w}mm;
    height: ${label.h}mm;
    padding: 2mm;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5mm;
  }
  .logo {
    font-size: ${logoSize}pt;
    font-weight: 700;
    letter-spacing: 1.5px;
  }
  .name {
    font-size: ${nameSize}pt;
    font-weight: 600;
  }
  .ar {
    font-size: ${arSize}pt;
    line-height: 1.4;
    direction: rtl;
  }
  .en {
    font-size: ${enSize}pt;
    color: #666;
    direction: ltr;
  }
  .social {
    font-size: ${socialSize}pt;
    color: #999;
  }
  @media screen {
    body { background: #f5f0e8; min-height: 100vh; width: auto; height: auto; }
    .label { border: 1px dashed #ccc; border-radius: 4mm; background: #fff; width: ${label.w * 3}px; height: ${label.h * 3}px; }
  }
</style>
</head>
<body>
<div class="label">
  <div class="logo">SHEEN</div>
  ${customerName ? `<div class="name">${customerName}</div>` : ''}
  <div class="ar">${sticker.message_ar}</div>
  <div class="en">${sticker.message_en}</div>
  <div class="social">@SheenCafe</div>
</div>
</body>
</html>`)
    printWindow.document.close()
    setTimeout(() => { printWindow.print() }, 500)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Label size selector */}
        <div className="px-5 pt-4 pb-2">
          <p className="font-body text-[10px] text-sheen-muted uppercase tracking-wider mb-2">{t('labelSize')}</p>
          <div className="flex gap-1.5">
            {LABEL_SIZES.map((sz, idx) => (
              <button
                key={idx}
                onClick={() => changeLabelSize(idx)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-body transition-colors ${
                  labelIdx === idx
                    ? 'bg-sheen-brown text-white'
                    : 'bg-sheen-cream text-sheen-muted'
                }`}
              >
                {sz.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="px-5 py-3 flex justify-center">
          <div
            className="border-2 border-dashed border-sheen-gold rounded-xl flex flex-col items-center justify-center text-center"
            style={{
              width: `${label.w * 3}px`,
              height: `${label.h * 3}px`,
              padding: '6px',
            }}
          >
            <p className="font-display text-lg font-bold text-sheen-gold tracking-wider leading-none">SHEEN</p>
            {customerName && (
              <p className="font-body text-[10px] text-sheen-brown font-semibold mt-0.5">{customerName}</p>
            )}
            <p className="font-body text-xs text-sheen-black leading-snug mt-1" dir="rtl">{sticker?.message_ar}</p>
            <p className="font-body text-[8px] text-sheen-muted mt-0.5" dir="ltr">{sticker?.message_en}</p>
            <p className="font-body text-[7px] text-sheen-muted mt-0.5">@SheenCafe</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-4 flex gap-2">
          <button
            onClick={() => fetchRandom()}
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
