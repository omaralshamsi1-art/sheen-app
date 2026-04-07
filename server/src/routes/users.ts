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

// GET /api/users/role/:userId — get or auto-create role for a user
// Query param: ?email=user@example.com (used to create record if missing)
router.get('/role/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    const email = req.query.email as string | undefined

    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      // No role found — auto-create as customer so admin can manage them
      const { data: newRecord, error: insertErr } = await supabase
        .from('user_roles')
        .upsert(
          { user_id: userId, email: email ?? '', role: 'customer' },
          { onConflict: 'user_id' }
        )
        .select()
        .single()

      if (insertErr || !newRecord) {
        res.json({ role: 'customer' })
        return
      }
      res.json(newRecord)
      return
    }
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/users — add or update a user role (looks up UUID by email automatically)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, role, password } = req.body

    if (!email || typeof email !== 'string') {
      res.status(400).json({ message: 'email is required' })
      return
    }
    if (!role || !VALID_ROLES.includes(role)) {
      res.status(400).json({ message: `role must be one of: ${VALID_ROLES.join(', ')}` })
      return
    }

    const cleanEmail = email.trim().toLowerCase()

    // Try to find existing user in Supabase Auth by listing users
    const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers()
    if (listErr) throw listErr

    let userId: string | null = null
    const existingUser = users.find((u) => u.email?.toLowerCase() === cleanEmail)

    if (existingUser) {
      userId = existingUser.id
    } else {
      // User doesn't exist in Auth — create them with a password
      const userPassword = password || 'Sheen@2026'
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password: userPassword,
        email_confirm: true,
      })
      if (createErr) throw createErr
      userId = newUser.user.id
    }

    // Upsert role
    const { data, error } = await supabase
      .from('user_roles')
      .upsert(
        { user_id: userId, email: cleanEmail, role, updated_at: new Date().toISOString() },
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

// PATCH /api/users/:id — update role and/or allowed_pages by record id
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { role, allowed_pages, allowed_payment_methods } = req.body

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }

    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        res.status(400).json({ message: `role must be one of: ${VALID_ROLES.join(', ')}` })
        return
      }
      updates.role = role
    }

    if (allowed_pages !== undefined) {
      if (!Array.isArray(allowed_pages)) {
        res.status(400).json({ message: 'allowed_pages must be an array of strings' })
        return
      }
      updates.allowed_pages = allowed_pages
    }

    if (allowed_payment_methods !== undefined) {
      if (!Array.isArray(allowed_payment_methods)) {
        res.status(400).json({ message: 'allowed_payment_methods must be an array of strings' })
        return
      }
      updates.allowed_payment_methods = allowed_payment_methods
    }

    const { data, error } = await supabase
      .from('user_roles')
      .update(updates)
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
