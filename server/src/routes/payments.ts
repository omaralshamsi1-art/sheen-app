import { Router, Request, Response } from 'express'
import Stripe from 'stripe'

const router = Router()

const stripe = new (Stripe as any)(process.env.STRIPE_SECRET_KEY!)

// POST /api/payments/create-intent
// Body: { amount (in AED), customer_email?, metadata? }
router.post('/create-intent', async (req: Request, res: Response) => {
  try {
    const { amount, customer_email, metadata } = req.body

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ message: 'amount must be a positive number (in AED)' })
      return
    }

    // Stripe expects amount in fils (smallest currency unit) for AED
    // 1 AED = 100 fils
    const amountInFils = Math.round(amount * 100)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInFils,
      currency: 'aed',
      payment_method_types: ['card'],
      receipt_email: customer_email || undefined,
      metadata: metadata || {},
    })

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })
  } catch (err: any) {
    console.error('Stripe error:', err.message)
    res.status(500).json({ message: err.message })
  }
})

// GET /api/payments/:id — check payment status
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(req.params.id)
    res.json({
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
    })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
