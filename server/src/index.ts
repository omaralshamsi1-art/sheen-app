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

app.get('/health', (_, res) => res.json({ status: 'ok' }))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`SHEEN server running on port ${PORT}`)
})
