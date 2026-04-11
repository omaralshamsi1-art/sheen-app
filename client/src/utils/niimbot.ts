// NIIMBOT label printer client over WebSerial
// Supports B1 / D11 / D110 family. Connects to a USB-serial COM port
// and sends the NIIMBOT packet protocol to print a bitmap.
//
// Browser support: Chrome / Edge desktop only.
//
// The NIIMBOT protocol is request/response: every command packet receives
// an ACK packet (command code + offset). A background read loop collects
// incoming bytes; send() waits for the matching response.

export interface NiimbotPrintOptions {
  density?: number        // 1-5 (default 3)
  labelType?: number      // 1=gap, 2=continuous, 3=black-mark (default 1)
  quantity?: number       // number of copies (default 1)
}

type SerialPort = any

// ── Packet helpers ──────────────────────────────────────────────────────────
const PKT_START = [0x55, 0x55]
const PKT_END = [0xAA, 0xAA]

function makePacket(cmd: number, data: number[]): Uint8Array {
  const len = data.length
  let checksum = cmd ^ len
  for (const b of data) checksum ^= b
  return new Uint8Array([...PKT_START, cmd, len, ...data, checksum & 0xFF, ...PKT_END])
}

const CMD = {
  HEARTBEAT: 0xDC,
  GET_INFO: 0x40,
  GET_RFID: 0x1A,           // Read RFID tag of loaded label (B1 requires)
  GET_PRINT_STATUS: 0xA3,   // Poll printing progress
  SET_DENSITY: 0x21,
  SET_LABEL_TYPE: 0x23,
  START_PRINT: 0x01,
  ALLOW_PRINT_CLEAR: 0x20,  // B1 family requires this after START_PRINT
  START_PAGE: 0x03,
  SET_PAGE_SIZE: 0x13,
  SET_QUANTITY: 0x15,
  PRINT_EMPTY_ROW: 0x84,
  PRINT_BITMAP_ROW: 0x85,
  END_PAGE: 0xE3,
  END_PRINT: 0xF3,
}

// NIIMBOT B1 print head is 384 dots wide (48mm at 8 dots/mm)
export const B1_MAX_WIDTH = 384

// NIIMBOT BLE GATT service & characteristic UUIDs (B1/B21/D11 family)
const NIIMBOT_SERVICE_UUID = 'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
const NIIMBOT_CHAR_UUID = 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f'

// ── Bitmap conversion ──────────────────────────────────────────────────────
// Build a test pattern canvas: solid black bars at known row positions
export function buildTestPatternCanvas(widthPx = 240, heightPx = 400): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = widthPx
  c.height = heightPx
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, widthPx, heightPx)
  ctx.fillStyle = '#000000'
  // Three solid black bars across the whole width
  ctx.fillRect(0, 50, widthPx, 30)
  ctx.fillRect(0, 180, widthPx, 30)
  ctx.fillRect(0, 310, widthPx, 30)
  // Big text marker
  ctx.font = 'bold 60px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('TEST', widthPx / 2, heightPx / 2)
  return c
}

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
      const lum = imgData.data[i] * 0.299 + imgData.data[i + 1] * 0.587 + imgData.data[i + 2] * 0.114
      if (lum < threshold) row[x >> 3] |= 1 << (7 - (x & 7))
    }
    rows.push(row)
  }
  return rows
}

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

// ── WebSerial IO with request/response ─────────────────────────────────────
export class NiimbotPrinter {
  private port: SerialPort | null = null
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private readBuffer: number[] = []
  private readLoopAbort = false

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator
  }

  async connect(baudRate: number = 115200): Promise<void> {
    if (!NiimbotPrinter.isSupported()) {
      throw new Error('WebSerial is not supported. Use Chrome or Edge on desktop.')
    }
    this.port = await (navigator as any).serial.requestPort()
    await this.port.open({ baudRate })
    console.log('[NIIMBOT] port opened at', baudRate, 'baud')
    this.writer = this.port.writable.getWriter()
    this.reader = this.port.readable.getReader()
    this.readLoopAbort = false
    this._startReadLoop()
  }

  async disconnect(): Promise<void> {
    this.readLoopAbort = true
    try { if (this.reader) { await this.reader.cancel().catch(() => {}); this.reader.releaseLock(); this.reader = null } } catch {}
    try { if (this.writer) { this.writer.releaseLock(); this.writer = null } } catch {}
    try { if (this.port) { await this.port.close(); this.port = null } } catch {}
  }

  private async _startReadLoop() {
    if (!this.reader) return
    const reader = this.reader
    ;(async () => {
      try {
        while (!this.readLoopAbort) {
          const { value, done } = await reader.read()
          if (done) break
          if (value) {
            for (let i = 0; i < value.length; i++) this.readBuffer.push(value[i])
          }
        }
      } catch (e) {
        // reader cancelled or stream closed
      }
    })()
  }

  private sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

  // Parse one packet out of the read buffer if possible, return [cmd, data] or null
  private parseOnePacket(): { cmd: number; data: Uint8Array } | null {
    const buf = this.readBuffer
    // Need at least 7 bytes for the smallest packet (start×2, cmd, len=0, chk, end×2)
    while (buf.length >= 7) {
      // Locate start sequence 0x55 0x55
      if (buf[0] !== 0x55 || buf[1] !== 0x55) { buf.shift(); continue }
      const cmd = buf[2]
      const len = buf[3]
      const totalLen = 4 + len + 1 + 2 // header + data + checksum + end
      if (buf.length < totalLen) return null
      const data = new Uint8Array(buf.slice(4, 4 + len))
      // Verify end markers
      if (buf[4 + len + 1] !== 0xAA || buf[4 + len + 2] !== 0xAA) {
        buf.shift()
        continue
      }
      // Remove the consumed bytes
      buf.splice(0, totalLen)
      return { cmd, data }
    }
    return null
  }

  // Drain all currently-buffered packets, log them
  private drainPackets() {
    let pkt
    while ((pkt = this.parseOnePacket())) {
      console.log('[NIIMBOT] rx', '0x' + pkt.cmd.toString(16).padStart(2, '0'), Array.from(pkt.data))
    }
  }

  private async send(packet: Uint8Array) {
    if (!this.writer) throw new Error('Printer not connected')
    await this.writer.write(packet)
  }

  // Send a command packet, optionally wait for any response packet
  private async sendCmd(cmd: number, data: number[], waitMs = 40) {
    await this.send(makePacket(cmd, data))
    await this.sleep(waitMs)
    this.drainPackets()
  }

  async heartbeat() {
    await this.sendCmd(CMD.HEARTBEAT, [0x01], 100)
  }

  async printCanvas(canvas: HTMLCanvasElement, opts: NiimbotPrintOptions = {}) {
    const density = opts.density ?? 3
    const labelType = opts.labelType ?? 1
    const quantity = opts.quantity ?? 1

    const rows = canvasToMonoRows(canvas)
    const height = rows.length
    const width = canvas.width

    console.log('[NIIMBOT] printing', { width, height, density, labelType, quantity })

    // Heartbeat to verify the printer is alive
    await this.heartbeat()

    // Set density
    await this.sendCmd(CMD.SET_DENSITY, [density])
    // Set label type
    await this.sendCmd(CMD.SET_LABEL_TYPE, [labelType])
    // Start print
    await this.sendCmd(CMD.START_PRINT, [0x01])
    // Allow print clear — REQUIRED for B1 family
    await this.sendCmd(CMD.ALLOW_PRINT_CLEAR, [0x01])
    // Start page
    await this.sendCmd(CMD.START_PAGE, [0x01])
    // Page size (rows=height, cols=width)
    await this.sendCmd(CMD.SET_PAGE_SIZE, [
      (height >> 8) & 0xFF, height & 0xFF,
      (width >> 8) & 0xFF, width & 0xFF,
    ])
    // Quantity
    await this.sendCmd(CMD.SET_QUANTITY, [(quantity >> 8) & 0xFF, quantity & 0xFF])

    // Send each row (minimal inter-row pacing to avoid buffer overruns)
    for (let y = 0; y < height; y++) {
      const row = rows[y]
      if (rowIsEmpty(row)) {
        await this.send(makePacket(CMD.PRINT_EMPTY_ROW, [
          (y >> 8) & 0xFF, y & 0xFF, 1,
        ]))
      } else {
        const [c1, c2, c3] = rowPixelCounts(row, width)
        const data = [
          (y >> 8) & 0xFF, y & 0xFF,
          c1 & 0xFF, c2 & 0xFF, c3 & 0xFF,
          1,
          ...row,
        ]
        await this.send(makePacket(CMD.PRINT_BITMAP_ROW, data))
      }
      if (y % 16 === 0) {
        await this.sleep(5)
        this.drainPackets()
      }
    }

    // Short pause before end-of-page — some models drop the last rows otherwise
    await this.sleep(300)

    // End page
    await this.sendCmd(CMD.END_PAGE, [0x01], 100)
    // End print
    await this.sendCmd(CMD.END_PRINT, [0x01], 200)

    console.log('[NIIMBOT] done')
  }
}

// ── Bluetooth (Web Bluetooth) transport ─────────────────────────────────────
// The B1 is designed as a Bluetooth printer. Use this path whenever USB
// serial does not respond.
export class NiimbotBluetoothPrinter {
  private device: any = null
  private server: any = null
  private characteristic: any = null
  private readBuffer: number[] = []

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator
  }

  async connect(): Promise<void> {
    if (!NiimbotBluetoothPrinter.isSupported()) {
      throw new Error('Web Bluetooth not supported. Use Chrome or Edge on desktop.')
    }
    this.device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [NIIMBOT_SERVICE_UUID],
    })
    console.log('[NIIMBOT BLE] selected', this.device.name)
    this.server = await this.device.gatt.connect()
    const service = await this.server.getPrimaryService(NIIMBOT_SERVICE_UUID)
    this.characteristic = await service.getCharacteristic(NIIMBOT_CHAR_UUID)
    await this.characteristic.startNotifications()
    this.characteristic.addEventListener('characteristicvaluechanged', (e: any) => {
      const value: DataView = e.target.value
      for (let i = 0; i < value.byteLength; i++) this.readBuffer.push(value.getUint8(i))
    })
    console.log('[NIIMBOT BLE] connected')
  }

  async disconnect(): Promise<void> {
    try {
      if (this.characteristic) { await this.characteristic.stopNotifications().catch(() => {}) }
      if (this.server && this.server.connected) this.server.disconnect()
    } catch {}
    this.characteristic = null
    this.server = null
    this.device = null
  }

  private sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

  // Use writeValue (with ACK) — slower but guaranteed delivery so BLE stack
  // can't outrun the B1's buffer. writeValueWithoutResponse was dropping
  // roughly half the row packets.
  private async sendRaw(packet: Uint8Array) {
    if (!this.characteristic) throw new Error('Not connected')
    const CHUNK = 20
    for (let off = 0; off < packet.length; off += CHUNK) {
      const chunk = packet.slice(off, off + CHUNK)
      await this.characteristic.writeValue(chunk)
    }
  }

  private parseOnePacket(): { cmd: number; data: Uint8Array } | null {
    const buf = this.readBuffer
    while (buf.length >= 7) {
      if (buf[0] !== 0x55 || buf[1] !== 0x55) { buf.shift(); continue }
      const cmd = buf[2]
      const len = buf[3]
      const totalLen = 4 + len + 1 + 2
      if (buf.length < totalLen) return null
      const data = new Uint8Array(buf.slice(4, 4 + len))
      if (buf[4 + len + 1] !== 0xAA || buf[4 + len + 2] !== 0xAA) { buf.shift(); continue }
      buf.splice(0, totalLen)
      return { cmd, data }
    }
    return null
  }

  private drainPackets() {
    let pkt
    while ((pkt = this.parseOnePacket())) {
      console.log('[NIIMBOT BLE] rx', '0x' + pkt.cmd.toString(16).padStart(2, '0'), Array.from(pkt.data))
    }
  }

  private async sendCmd(cmd: number, data: number[], waitMs = 40) {
    await this.sendRaw(makePacket(cmd, data))
    await this.sleep(waitMs)
    this.drainPackets()
  }

  async heartbeat() {
    await this.sendCmd(CMD.HEARTBEAT, [0x01], 100)
  }

  async printCanvas(canvas: HTMLCanvasElement, opts: NiimbotPrintOptions = {}) {
    const density = opts.density ?? 3
    const labelType = opts.labelType ?? 1
    const quantity = opts.quantity ?? 1

    const rows = canvasToMonoRows(canvas)
    const height = rows.length
    const width = canvas.width

    console.log('[NIIMBOT BLE] printing', { width, height, density, labelType, quantity })

    // DEBUG: log first few non-empty rows so we can verify bits are reaching the wire
    let shown = 0
    for (let y = 0; y < rows.length && shown < 3; y++) {
      if (!rowIsEmpty(rows[y])) {
        const hex = Array.from(rows[y]).map(b => b.toString(16).padStart(2, '0')).join('')
        console.log(`[NIIMBOT BLE] row ${y}: ${hex}`)
        shown++
      }
    }

    await this.heartbeat()
    // Read RFID tag of loaded label — B1 expects this before any print job
    await this.sendCmd(CMD.GET_RFID, [0x01], 200)
    await this.sendCmd(CMD.SET_DENSITY, [density])
    await this.sendCmd(CMD.SET_LABEL_TYPE, [labelType])
    await this.sendCmd(CMD.START_PRINT, [0x01])
    await this.sendCmd(CMD.ALLOW_PRINT_CLEAR, [0x01])
    await this.sendCmd(CMD.START_PAGE, [0x01])
    await this.sendCmd(CMD.SET_PAGE_SIZE, [
      (height >> 8) & 0xFF, height & 0xFF,
      (width >> 8) & 0xFF, width & 0xFF,
    ])
    await this.sendCmd(CMD.SET_QUANTITY, [(quantity >> 8) & 0xFF, quantity & 0xFF])

    for (let y = 0; y < height; y++) {
      const row = rows[y]
      if (rowIsEmpty(row)) {
        await this.sendRaw(makePacket(CMD.PRINT_EMPTY_ROW, [
          (y >> 8) & 0xFF, y & 0xFF, 1,
        ]))
      } else {
        const [c1, c2, c3] = rowPixelCounts(row, width)
        const data = [
          (y >> 8) & 0xFF, y & 0xFF,
          Math.min(c1, 255), Math.min(c2, 255), Math.min(c3, 255),
          1,
          ...row,
        ]
        await this.sendRaw(makePacket(CMD.PRINT_BITMAP_ROW, data))
      }
      // Pace more aggressively so the BLE stack doesn't overrun
      if (y % 4 === 0) {
        await this.sleep(15)
        this.drainPackets()
      }
    }

    // All rows are now safely delivered because writeValue waits for ACK
    console.log('[NIIMBOT BLE] rows sent, ending job…')
    await this.sleep(500)
    this.drainPackets()

    // End page + poll status until printer says it's done (or we give up)
    await this.sendCmd(CMD.END_PAGE, [0x01], 500)

    for (let i = 0; i < 20; i++) {
      await this.sendCmd(CMD.GET_PRINT_STATUS, [0x01], 200)
      // If no fresh response and we're past the warmup, assume idle
      if (i >= 3 && this.readBuffer.length === 0) break
    }

    await this.sendCmd(CMD.END_PRINT, [0x01], 1000)
    await this.sendCmd(CMD.HEARTBEAT, [0x01], 500)

    console.log('[NIIMBOT BLE] done')
  }
}
