import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '' })

export async function createPaymentIntent(amount: number, customerEmail?: string) {
  const { data } = await api.post('/api/payments/create-intent', {
    amount,
    customer_email: customerEmail,
  })
  return data as { clientSecret: string; paymentIntentId: string }
}
