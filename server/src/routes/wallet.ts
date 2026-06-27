import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { verifyWalletAuth } from '../lib/walletPush'
import { generateApplePass, isAppleWalletConfigured, type LoyaltyCardData } from '../lib/wallet'
import { getVisitsForFreeCup } from './loyalty'

/**
 * Apple Wallet PassKit web service. Apple appends `/v1/...` to the pass's
 * webServiceURL, so this router is mounted at the base of that URL
 * (e.g. WALLET_WEB_SERVICE_URL = https://api.sheencafe.ae/api/wallet).
 * See https://developer.apple.com/documentation/walletpasses
 */

const router = Router()

// Requests carry `Authorization: ApplePass <token>` — validate it against the serial.
function authed(req: Request, serial: string): boolean {
  const header = req.header('Authorization') || ''
  const match = header.match(/^ApplePass\s+(.+)$/i)
  return verifyWalletAuth(serial, match?.[1])
}

// Register a device to receive updates for a pass.
router.post('/v1/devices/:device/registrations/:passType/:serial', async (req: Request, res: Response) => {
  const { device, passType, serial } = req.params
  if (!authed(req, String(serial))) { res.sendStatus(401); return }
  const pushToken = req.body?.pushToken
  if (!pushToken) { res.sendStatus(400); return }

  const { data: existing } = await supabase
    .from('wallet_registrations')
    .select('id')
    .eq('device_library_identifier', device)
    .eq('serial_number', serial)
    .maybeSingle()

  await supabase.from('wallet_registrations').upsert(
    {
      device_library_identifier: device,
      pass_type_identifier: passType,
      serial_number: serial,
      push_token: pushToken,
    },
    { onConflict: 'device_library_identifier,serial_number' },
  )

  res.sendStatus(existing ? 200 : 201)
})

// Unregister a device.
router.delete('/v1/devices/:device/registrations/:passType/:serial', async (req: Request, res: Response) => {
  const { device, serial } = req.params
  if (!authed(req, String(serial))) { res.sendStatus(401); return }
  await supabase
    .from('wallet_registrations')
    .delete()
    .eq('device_library_identifier', device)
    .eq('serial_number', serial)
  res.sendStatus(200)
})

// List the serial numbers of passes that changed since the given tag.
router.get('/v1/devices/:device/registrations/:passType', async (req: Request, res: Response) => {
  const { device, passType } = req.params
  const since = req.query.passesUpdatedSince as string | undefined

  const { data: regs } = await supabase
    .from('wallet_registrations')
    .select('serial_number')
    .eq('device_library_identifier', device)
    .eq('pass_type_identifier', passType)

  const serials = (regs ?? []).map((r) => r.serial_number as string)
  if (serials.length === 0) { res.sendStatus(204); return }

  const { data: cards } = await supabase
    .from('loyalty_cards')
    .select('qr_code, wallet_updated_at')
    .in('qr_code', serials)

  const sinceMs = since ? Number(since) : 0
  const stale = (cards ?? []).filter((c) => {
    const t = c.wallet_updated_at ? new Date(c.wallet_updated_at as string).getTime() : 0
    return t > sinceMs
  })
  if (stale.length === 0) { res.sendStatus(204); return }

  const lastUpdated = String(
    Math.max(...stale.map((c) => new Date(c.wallet_updated_at as string).getTime())),
  )
  res.json({ lastUpdated, serialNumbers: stale.map((c) => c.qr_code as string) })
})

// Return the latest signed pass for a serial.
router.get('/v1/passes/:passType/:serial', async (req: Request, res: Response) => {
  const { serial } = req.params
  if (!authed(req, String(serial))) { res.sendStatus(401); return }
  if (!isAppleWalletConfigured()) { res.sendStatus(501); return }

  const { data: card } = await supabase
    .from('loyalty_cards')
    .select('*')
    .eq('qr_code', serial)
    .single()
  if (!card) { res.sendStatus(404); return }

  const buffer = await generateApplePass(card as LoyaltyCardData, await getVisitsForFreeCup())
  res.setHeader('Content-Type', 'application/vnd.apple.pkpass')
  res.setHeader('Last-Modified', new Date().toUTCString())
  res.send(buffer)
})

// Apple posts diagnostic logs here.
router.post('/v1/log', (_req: Request, res: Response) => {
  res.sendStatus(200)
})

export default router
