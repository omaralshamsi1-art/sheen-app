import { Router, Request, Response } from 'express'
import { logAudit } from '../lib/audit'

const router = Router()

// POST /api/email/send-report — send PDF report via email
router.post('/send-report', async (req: Request, res: Response) => {
  try {
    const { to, subject, pdfBase64, filename } = req.body

    if (!to || !pdfBase64) {
      res.status(400).json({ message: 'to and pdfBase64 are required' })
      return
    }

    if (!process.env.RESEND_API_KEY) {
      res.status(500).json({ message: 'RESEND_API_KEY not configured' })
      return
    }

    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    const { error } = await resend.emails.send({
      from: 'SHEEN Coffee <onboarding@resend.dev>',
      to: [to],
      subject: subject || 'SHEEN Daily Sales Report',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; text-align: center; padding: 30px 20px;">
          <h1 style="color: #8B4513; font-size: 28px; letter-spacing: 2px; margin-bottom: 4px;">SHEEN</h1>
          <p style="color: #A0785A; font-size: 12px; margin-bottom: 20px;">Coffee Shop</p>
          <hr style="border: none; border-top: 1px solid #D4A843; margin: 20px 0;" />
          <p style="color: #333; font-size: 14px;">Please find attached your daily sales report.</p>
          <p style="color: #999; font-size: 11px; margin-top: 20px;">@SheenCafe</p>
        </div>
      `,
      attachments: [
        {
          filename: filename || 'SHEEN-Daily-Report.pdf',
          content: pdfBase64,
        },
      ],
    })

    if (error) throw new Error(JSON.stringify(error))

    await logAudit(req, { action: 'create', entity: 'order', entity_id: 'email', details: { page: 'Sales', action: 'Report emailed', to } })
    res.json({ message: 'Email sent' })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
