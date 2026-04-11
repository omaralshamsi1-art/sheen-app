import { useState, useRef, useEffect } from 'react'
import api from '../lib/api'
import { useLanguage } from '../i18n/LanguageContext'
import { NiimbotPrinter, NiimbotBluetoothPrinter, B1_MAX_WIDTH } from '../utils/niimbot'
import toast from 'react-hot-toast'

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
  const [niimPrinting, setNiimPrinting] = useState(false)
  const [niimDensity, setNiimDensity] = useState<number>(() => Number(localStorage.getItem('niim-density')) || 3)
  const [niimLabelType, setNiimLabelType] = useState<number>(() => Number(localStorage.getItem('niim-label-type')) || 1)
  const [niimBaud, setNiimBaud] = useState<number>(() => Number(localStorage.getItem('niim-baud')) || 115200)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const niimbotRef = useRef<NiimbotPrinter | null>(null)
  const niimBleRef = useRef<NiimbotBluetoothPrinter | null>(null)
  const [blePrinting, setBlePrinting] = useState(false)

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
    // Scale all fonts relative to canvas height for readability
    const unit = h / 10

    // SHEEN logo
    ctx.fillStyle = '#000000'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `bold ${Math.round(unit * 1.8)}px Arial, Helvetica, sans-serif`
    let y = unit * 1.2
    ctx.fillText('SHEEN', cx, y)

    // Customer name
    if (customerName) {
      y += unit * 1.1
      ctx.font = `600 ${Math.round(unit * 0.85)}px Arial, Helvetica, sans-serif`
      ctx.fillStyle = '#333333'
      ctx.fillText(customerName, cx, y)
    }

    // Arabic message — large and clear
    y += unit * 1.3
    ctx.fillStyle = '#000000'
    const arFontSize = Math.round(unit * 1.1)
    ctx.font = `bold ${arFontSize}px Arial, Helvetica, sans-serif`

    const arText = sticker.message_ar
    const maxWidth = w * 0.9
    const arLines = wrapText(ctx, arText, maxWidth)

    for (const line of arLines) {
      ctx.fillText(line, cx, y)
      y += arFontSize * 1.25
    }

    // English message
    y += unit * 0.3
    ctx.fillStyle = '#666666'
    const enFontSize = Math.round(unit * 0.7)
    ctx.font = `${enFontSize}px Arial, Helvetica, sans-serif`
    const enLines = wrapText(ctx, sticker.message_en, maxWidth)
    for (const line of enLines) {
      ctx.fillText(line, cx, y)
      y += enFontSize * 1.2
    }

    // @SheenCafe
    y += unit * 0.2
    ctx.fillStyle = '#999999'
    ctx.font = `${Math.round(unit * 0.6)}px Arial, Helvetica, sans-serif`
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

  // Build a canvas at NIIMBOT native DPI, auto-rotated to fit the 384-dot print head
  const buildPrintCanvas = (): HTMLCanvasElement | null => {
    const canvas = canvasRef.current
    if (!canvas || !sticker) return null
    const PRINT_DPI = 203
    const pxFromMm = (mm: number) => Math.round((mm / 25.4) * PRINT_DPI)
    const w = pxFromMm(label.w)
    const h = pxFromMm(label.h)
    const needRotate = w > B1_MAX_WIDTH
    const printCanvas = document.createElement('canvas')
    if (needRotate) { printCanvas.width = h; printCanvas.height = w }
    else { printCanvas.width = w; printCanvas.height = h }
    const ctx = printCanvas.getContext('2d')!
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, printCanvas.width, printCanvas.height)
    if (needRotate) {
      ctx.save()
      ctx.translate(printCanvas.width, 0)
      ctx.rotate(Math.PI / 2)
      ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, w, h)
      ctx.restore()
    } else {
      ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, w, h)
    }
    console.log('[NIIMBOT] print canvas', printCanvas.width, '×', printCanvas.height, needRotate ? '(rotated)' : '')
    return printCanvas
  }

  // Print via NIIMBOT over WebSerial (Chrome/Edge desktop)
  const handleNiimbotPrint = async () => {
    if (!NiimbotPrinter.isSupported()) {
      toast.error('WebSerial not supported. Use Chrome or Edge on desktop.')
      return
    }
    const printCanvas = buildPrintCanvas()
    if (!printCanvas) return

    setNiimPrinting(true)
    try {
      niimbotRef.current = new NiimbotPrinter()
      await niimbotRef.current.connect(niimBaud)
      await niimbotRef.current.printCanvas(printCanvas, { density: niimDensity, labelType: niimLabelType, quantity: 1 })
      toast.success('Sticker sent to printer')
    } catch (err: any) {
      console.error('[NIIMBOT]', err)
      toast.error(err?.message || 'Print failed')
    } finally {
      await niimbotRef.current?.disconnect()
      niimbotRef.current = null
      setNiimPrinting(false)
    }
  }

  // Print via NIIMBOT over Web Bluetooth — the native path for B1
  const handleNiimbotBlePrint = async () => {
    if (!NiimbotBluetoothPrinter.isSupported()) {
      toast.error('Web Bluetooth not supported. Use Chrome or Edge on desktop.')
      return
    }
    const printCanvas = buildPrintCanvas()
    if (!printCanvas) return

    setBlePrinting(true)
    try {
      niimBleRef.current = new NiimbotBluetoothPrinter()
      await niimBleRef.current.connect()
      await niimBleRef.current.printCanvas(printCanvas, { density: niimDensity, labelType: niimLabelType, quantity: 1 })
      toast.success('Sticker sent via Bluetooth')
    } catch (err: any) {
      console.error('[NIIMBOT BLE]', err)
      toast.error(err?.message || 'Bluetooth print failed')
    } finally {
      await niimBleRef.current?.disconnect()
      niimBleRef.current = null
      setBlePrinting(false)
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
        <div className="px-5 pb-4 space-y-2">
          <div className="flex gap-2">
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

          {/* NIIMBOT USB direct print — Chrome/Edge desktop only */}
          {NiimbotPrinter.isSupported() && (
            <div className="pt-2 border-t border-sheen-cream space-y-2">
              <p className="font-body text-[10px] text-sheen-muted uppercase tracking-wider">NIIMBOT USB</p>

              {/* Baud rate */}
              <div className="flex items-center gap-2">
                <span className="font-body text-xs text-sheen-muted w-14">Baud</span>
                <div className="flex gap-1 flex-wrap">
                  {[115200, 230400, 460800, 921600, 1000000].map(b => (
                    <button
                      key={b}
                      onClick={() => { setNiimBaud(b); localStorage.setItem('niim-baud', String(b)) }}
                      className={`px-2 h-7 rounded-md text-[10px] font-body font-medium ${
                        niimBaud === b ? 'bg-sheen-brown text-white' : 'bg-sheen-cream text-sheen-muted'
                      }`}
                    >
                      {b >= 1000000 ? '1M' : `${b / 1000}k`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Density */}
              <div className="flex items-center gap-2">
                <span className="font-body text-xs text-sheen-muted w-14">Density</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(d => (
                    <button
                      key={d}
                      onClick={() => { setNiimDensity(d); localStorage.setItem('niim-density', String(d)) }}
                      className={`w-7 h-7 rounded-md text-[11px] font-body font-medium ${
                        niimDensity === d ? 'bg-sheen-brown text-white' : 'bg-sheen-cream text-sheen-muted'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Label type */}
              <div className="flex items-center gap-2">
                <span className="font-body text-xs text-sheen-muted w-14">Label</span>
                <div className="flex gap-1">
                  {[
                    { v: 1, l: 'Gap' },
                    { v: 2, l: 'Continuous' },
                    { v: 3, l: 'Black-mark' },
                  ].map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => { setNiimLabelType(opt.v); localStorage.setItem('niim-label-type', String(opt.v)) }}
                      className={`px-2.5 h-7 rounded-md text-[11px] font-body font-medium ${
                        niimLabelType === opt.v ? 'bg-sheen-brown text-white' : 'bg-sheen-cream text-sheen-muted'
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      const p = new NiimbotPrinter()
                      await p.connect(niimBaud)
                      await p.heartbeat()
                      await new Promise(r => setTimeout(r, 300))
                      await p.disconnect()
                      toast.success('Heartbeat sent — check console for response')
                    } catch (e: any) {
                      toast.error(e?.message || 'Heartbeat failed')
                    }
                  }}
                  className="px-3 py-2.5 rounded-lg bg-sheen-cream text-sheen-brown font-body text-xs font-medium"
                >
                  Test ping
                </button>
                <button
                  onClick={handleNiimbotPrint}
                  disabled={niimPrinting}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-sheen-black text-white font-body text-sm font-medium hover:bg-sheen-black/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {niimPrinting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                      Printing…
                    </>
                  ) : (
                    <>🖨️ Print via NIIMBOT USB</>
                  )}
                </button>
              </div>

              {/* Bluetooth print — the native path for B1 */}
              {NiimbotBluetoothPrinter.isSupported() && (
                <button
                  onClick={handleNiimbotBlePrint}
                  disabled={blePrinting}
                  className="w-full px-4 py-2.5 rounded-lg bg-blue-600 text-white font-body text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {blePrinting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                      Printing via Bluetooth…
                    </>
                  ) : (
                    <>📶 Print via NIIMBOT Bluetooth</>
                  )}
                </button>
              )}
            </div>
          )}
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
