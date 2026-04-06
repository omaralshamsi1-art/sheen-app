import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'

const router = Router()

const VALID_ROLES = ['admin', 'staff', 'customer']

// GET /api/users — list all user roles
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data ?? [])
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/users/role/:userId — get role for a specific user
router.get('/role/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      // No role found — return default customer
      res.json({ role: 'customer' })
      return
    }
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/users — add or update a user role
router.post('/', async (req: Request, res: Response) => {
  try {
    const { user_id, email, role } = req.body

    if (!user_id || typeof user_id !== 'string') {
      res.status(400).json({ message: 'user_id is required' })
      return
    }
    if (!email || typeof email !== 'string') {
      res.status(400).json({ message: 'email is required' })
      return
    }
    if (!role || !VALID_ROLES.includes(role)) {
      res.status(400).json({ message: `role must be one of: ${VALID_ROLES.join(', ')}` })
      return
    }

    // Upsert — insert or update if user_id already exists
    const { data, error } = await supabase
      .from('user_roles')
      .upsert(
        { user_id, email: email.trim().toLowerCase(), role, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// PATCH /api/users/:id — update role by record id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { role } = req.body

    if (!role || !VALID_ROLES.includes(role)) {
      res.status(400).json({ message: `role must be one of: ${VALID_ROLES.join(', ')}` })
      return
    }

    const { data, error } = await supabase
      .from('user_roles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/users/:id — remove a user role record
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('id', id)

    if (error) throw error
    res.json({ message: 'User role deleted' })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
