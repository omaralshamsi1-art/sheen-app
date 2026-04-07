import { useState, useRef, useEffect } from 'react'
import api from '../lib/api'
import { useLanguage } from '../i18n/LanguageContext'

interface StickerMessage {
  id: string
  message_ar: string
  message_en: string
}

// SK 20 label sizes (width x height in mm)
const LABEL_SIZES = [
  { label: '50 \u00d7 30 mm', w: 50, h: 30 },
  { label: '50 \u00d7 40 mm', w: 50, h: 40 },
  { label: '40 \u00d7 30 mm', w: 40, h: 30 },
  { label: '60 \u00d7 40 mm', w: 60, h: 40 },
] as const

// Higher DPI for crisp rendering (300 DPI for sharp text)
const DPI = 300
const mmToPx = (mm: number) => Math.round((mm / 25.4) * DPI)

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
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

  // Render sticker to canvas as PNG image
  const renderToCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas || !sticker) return null

    const w = mmToPx(label.w)
    const h = mmToPx(label.h)
    canvas.width = w
    canvas.height = h

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // White background
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, w, h)

    const cx = w / 2
    const scale = label.w / 50 // normalize to 50mm

    // SHEEN logo
    ctx.fillStyle = '#000000'
    ctx.textAlign = 'center'
    ctx.font = `bold ${Math.round(28 * scale)}px Arial, Helvetica, sans-serif`
    let y = h * 0.18
    ctx.fillText('SHEEN', cx, y)

    // Customer name
    if (customerName) {
      y += Math.round(20 * scale)
      ctx.font = `600 ${Math.round(14 * scale)}px Arial, Helvetica, sans-serif`
      ctx.fillStyle = '#333333'
      ctx.fillText(customerName, cx, y)
    }

    // Arabic message — may need to wrap
    y += Math.round(22 * scale)
    ctx.fillStyle = '#000000'
    const arFontSize = Math.round(16 * scale)
    ctx.font = `500 ${arFontSize}px Arial, Helvetica, sans-serif`

    const arText = sticker.message_ar
    const maxWidth = w * 0.88
    const arLines = wrapText(ctx, arText, maxWidth)

    for (const line of arLines) {
      ctx.fillText(line, cx, y)
      y += arFontSize * 1.3
    }

    // English message
    y += Math.round(4 * scale)
    ctx.fillStyle = '#888888'
    ctx.font = `${Math.round(10 * scale)}px Arial, Helvetica, sans-serif`
    ctx.fillText(sticker.message_en, cx, y)

    // @SheenCafe
    y += Math.round(14 * scale)
    ctx.fillStyle = '#AAAAAA'
    ctx.font = `${Math.round(9 * scale)}px Arial, Helvetica, sans-serif`
    ctx.fillText('@SheenCafe', cx, y)

    return canvas.toDataURL('image/png')
  }

  // Regenerate image when sticker or label size changes
  useEffect(() => {
    if (sticker) {
      // Small delay to ensure canvas is ready
      setTimeout(() => {
        const url = renderToCanvas()
        setImageUrl(url)
      }, 50)
    }
  }, [sticker, labelIdx, customerName])

  // Share as image (for OpenLabel on iPad)
  const handleShare = async () => {
    const url = renderToCanvas()
    if (!url) return

    try {
      // Convert data URL to blob
      const res = await fetch(url)
      const blob = await res.blob()
      const file = new File([blob], 'sheen-sticker.png', { type: 'image/png' })

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'SHEEN Sticker',
        })
      } else {
        // Fallback: download the image
        const a = document.createElement('a')
        a.href = url
        a.download = 'sheen-sticker.png'
        a.click()
      }
    } catch {
      // User cancelled share or not supported — try download
      const a = document.createElement('a')
      a.href = url!
      a.download = 'sheen-sticker.png'
      a.click()
    }
  }

  // Print via browser print dialog
  const handlePrint = () => {
    const url = renderToCanvas()
    if (!url) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: ${label.w}mm ${label.h}mm; margin: 0; }
  * { margin: 0; padding: 0; }
  body { display: flex; align-items: center; justify-content: center; }
  img { width: ${label.w}mm; height: ${label.h}mm; }
  @media screen { body { min-height: 100vh; background: #f5f0e8; } }
</style>
</head>
<body>
<img src="${url}" />
</body>
</html>`)
    printWindow.document.close()
    setTimeout(() => { printWindow.print() }, 300)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Hidden canvas for rendering */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Label size selector */}
        <div className="px-5 pt-4 pb-2">
          <p className="font-body text-[10px] text-sheen-muted uppercase tracking-wider mb-2">{t('labelSize')}</p>
          <div className="flex gap-1.5 flex-wrap">
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

        {/* Preview — large readable preview */}
        <div className="px-5 py-3 flex justify-center">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Sticker preview"
              className="border border-sheen-muted/20 rounded-lg w-full"
              style={{ aspectRatio: `${label.w} / ${label.h}` }}
            />
          ) : (
            <div
              className="border-2 border-dashed border-sheen-gold rounded-xl flex items-center justify-center w-full"
              style={{ aspectRatio: `${label.w} / ${label.h}` }}
            >
              <p className="font-body text-xs text-sheen-muted">{t('loading')}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-4 flex gap-2">
          <button
            onClick={() => fetchRandom()}
            className="px-4 py-2.5 rounded-lg bg-sheen-cream text-sheen-brown font-body text-sm font-medium hover:bg-sheen-gold/20 transition-colors"
          >
            {t('shuffle')}
          </button>
          <button
            onClick={handleShare}
            className="flex-1 px-4 py-2.5 rounded-lg bg-sheen-gold text-sheen-black font-body text-sm font-medium hover:bg-sheen-gold/90 transition-colors"
          >
            {t('shareToApp')}
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-lg bg-sheen-brown text-white font-body text-sm font-medium hover:bg-sheen-brown/90 transition-colors"
          >
            {t('printSticker')}
          </button>
        </div>
      </div>
    </div>
  )
}

// Helper: wrap text into multiple lines if too wide
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}
