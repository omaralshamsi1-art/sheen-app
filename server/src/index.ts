import express from 'express'
import cors from 'cors'
import 'dotenv/config'

import salesRouter from './routes/sales'
import expensesRouter from './routes/expenses'
import fixedCostsRouter from './routes/fixedCosts'
import menuRouter from './routes/menu'
import ingredientsRouter from './routes/ingredients'
import reportsRouter from './routes/reports'
import aiRouter from './routes/ai'
import usersRouter from './routes/users'
import ordersRouter from './routes/orders'
import paymentsRouter from './routes/payments'
import auditRouter from './routes/audit'
import stickersRouter from './routes/stickers'
import loyaltyRouter from './routes/loyalty'
import settingsRouter from './routes/settings'

const app = express()

app.use(cors({ origin: process.env.CLIENT_URL }))
app.use(express.json({ limit: '1mb' }))

app.use('/api/sales', salesRouter)
app.use('/api/expenses', expensesRouter)
app.use('/api/fixed-costs', fixedCostsRouter)
app.use('/api/menu', menuRouter)
app.use('/api/ingredients', ingredientsRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/ai', aiRouter)
app.use('/api/users', usersRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/payments', paymentsRouter)
app.use('/api/audit', auditRouter)
app.use('/api/stickers', stickersRouter)
app.use('/api/loyalty', loyaltyRouter)
app.use('/api/settings', settingsRouter)

app.get('/health', (_, res) => res.json({ status: 'ok', version: '2.1' }))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`SHEEN server running on port ${PORT}`)
})
