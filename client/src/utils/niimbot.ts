// NIIMBOT label printer client over WebSerial
// Supports B1 / D11 / D110 family. Connects to a USB-serial COM port
// and sends the NIIMBOT packet protocol to print a bitmap.
//
// Browser support: Chrome / Edge desktop only.

export interface NiimbotPrintOptions {
  density?: number        // 1-5 (default 3)
  labelType?: number      // 1=gap, 2=continuous, 3=black-mark (default 1)
  quantity?: number       // number of copies (default 1)
  printerDotsPerMm?: number // default 8 (≈ 203 DPI)
}

type SerialPort = any // WebSerial types not always available

// ── Packet helpers ──────────────────────────────────────────────────────────
const PKT_START = [0x55, 0x55]
const PKT_END = [0xAA, 0xAA]

function makePacket(cmd: number, data: number[]): Uint8Array {
  const len = data.length
  const body = [cmd, len, ...data]
  let checksum = 0
  for (const b of body) checksum ^= b
  return new Uint8Array([...PKT_START, ...body, checksum & 0xFF, ...PKT_END])
}

// NIIMBOT command codes (B1/D11 family)
const CMD = {
  SET_DENSITY: 0x21,
  SET_LABEL_TYPE: 0x23,
  START_PRINT: 0x01,
  START_PAGE: 0x03,
  SET_PAGE_SIZE: 0x13,
  SET_QUANTITY: 0x15,
  PRINT_EMPTY_ROW: 0x84,
  PRINT_BITMAP_ROW: 0x85,
  END_PAGE: 0xE3,
  END_PRINT: 0xF3,
}

// ── Bitmap conversion ──────────────────────────────────────────────────────
// Convert canvas → monochrome bitmap: one bit per pixel, packed MSB first.
// Returns rows[] where each row is a Uint8Array of width/8 bytes.
export function canvasToMonoRows(canvas: HTMLCanvasElement, threshold = 128): Uint8Array[] {
  const ctx = canvas.getContext('2d')!
  const { width, height } = canvas
  const imgData = ctx.getImageData(0, 0, width, height)
  const bytesPerRow = Math.ceil(width / 8)
  const rows: Uint8Array[] = []

  for (let y = 0; y < height; y++) {
    const row = new Uint8Array(bytesPerRow)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      // Grayscale luminance
      const lum = (imgData.data[i] * 0.299 + imgData.data[i + 1] * 0.587 + imgData.data[i + 2] * 0.114)
      const black = lum < threshold ? 1 : 0
      if (black) {
        row[x >> 3] |= 1 << (7 - (x & 7))
      }
    }
    rows.push(row)
  }
  return rows
}

// Count black pixels in the three horizontal thirds of a row (NIIMBOT needs this)
function rowPixelCounts(row: Uint8Array, width: number): [number, number, number] {
  const thirds: [number, number, number] = [0, 0, 0]
  for (let x = 0; x < width; x++) {
    if (row[x >> 3] & (1 << (7 - (x & 7)))) {
      const t = x < width / 3 ? 0 : x < (2 * width / 3) ? 1 : 2
      thirds[t]++
    }
  }
  return thirds
}

function rowIsEmpty(row: Uint8Array): boolean {
  for (let i = 0; i < row.length; i++) if (row[i] !== 0) return false
  return true
}

// ── WebSerial IO ────────────────────────────────────────────────────────────
export class NiimbotPrinter {
  private port: SerialPort | null = null
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator
  }

  async connect(): Promise<void> {
    if (!NiimbotPrinter.isSupported()) {
      throw new Error('WebSerial is not supported in this browser. Use Chrome or Edge on desktop.')
    }
    // Request any serial device — user picks the NIIMBOT port in the prompt
    this.port = await (navigator as any).serial.requestPort()
    await this.port.open({ baudRate: 115200 })
    this.writer = this.port.writable.getWriter()
  }

  async disconnect(): Promise<void> {
    try {
      if (this.writer) { await this.writer.releaseLock(); this.writer = null }
      if (this.port) { await this.port.close(); this.port = null }
    } catch {
      // ignore
    }
  }

  private async send(packet: Uint8Array) {
    if (!this.writer) throw new Error('Printer not connected')
    await this.writer.write(packet)
  }

  // Small pause between commands — some NIIMBOT models need this
  private sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

  async printCanvas(canvas: HTMLCanvasElement, opts: NiimbotPrintOptions = {}) {
    const density = opts.density ?? 3
    const labelType = opts.labelType ?? 1
    const quantity = opts.quantity ?? 1

    const rows = canvasToMonoRows(canvas)
    const height = rows.length
    const width = canvas.width

    console.log('[NIIMBOT] printing', { width, height, density, labelType, quantity })

    // 1. Set density
    await this.send(makePacket(CMD.SET_DENSITY, [density]))
    await this.sleep(20)

    // 2. Set label type
    await this.send(makePacket(CMD.SET_LABEL_TYPE, [labelType]))
    await this.sleep(20)

    // 3. Start print
    await this.send(makePacket(CMD.START_PRINT, [0x01]))
    await this.sleep(20)

    // 4. Start page
    await this.send(makePacket(CMD.START_PAGE, [0x01]))
    await this.sleep(20)

    // 5. Set page size (rows=height, columns=width)
    await this.send(makePacket(CMD.SET_PAGE_SIZE, [
      (height >> 8) & 0xFF, height & 0xFF,
      (width >> 8) & 0xFF, width & 0xFF,
    ]))
    await this.sleep(20)

    // 6. Set print quantity
    await this.send(makePacket(CMD.SET_QUANTITY, [
      (quantity >> 8) & 0xFF, quantity & 0xFF,
    ]))
    await this.sleep(20)

    // 7. Send each row
    for (let y = 0; y < height; y++) {
      const row = rows[y]
      if (rowIsEmpty(row)) {
        // empty row — single packet skip
        await this.send(makePacket(CMD.PRINT_EMPTY_ROW, [
          (y >> 8) & 0xFF, y & 0xFF, 1,
        ]))
      } else {
        const [c1, c2, c3] = rowPixelCounts(row, width)
        const data = [
          (y >> 8) & 0xFF, y & 0xFF,
          c1 & 0xFF, c2 & 0xFF, c3 & 0xFF,
          1, // repeat count
          ...row,
        ]
        await this.send(makePacket(CMD.PRINT_BITMAP_ROW, data))
      }
      // Chunked pacing: small pause every 20 rows
      if (y % 20 === 0) await this.sleep(5)
    }

    // 8. End page
    await this.sleep(30)
    await this.send(makePacket(CMD.END_PAGE, [0x01]))
    await this.sleep(50)

    // 9. End print
    await this.send(makePacket(CMD.END_PRINT, [0x01]))
    await this.sleep(100)

    console.log('[NIIMBOT] done')
  }
}
