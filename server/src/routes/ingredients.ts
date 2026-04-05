import { Router, Request, Response } from 'express'
import { getIngredients } from '../services/db'

const router = Router()

// GET /api/ingredients
router.get('/', async (_req: Request, res: Response) => {
  try {
    const ingredients = await getIngredients()
    res.json(ingredients)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
