import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'

const router = Router()

const VALID_ROLES = ['admin', 'staff', 'customer']

// Fixed UUID for the "any customer" default settings record
const DEFAULT_CUSTOMER_ID = '00000000-0000-0000-0000-000000000000'

// GET /api/users/default-payment-methods — get default payment methods for any customer
router.get('/default-payment-methods', async (_req: Request, res: Response) => {
  try {
    const { data } = await supabase
      .from('user_roles')
      .select('allowed_payment_methods')
      .eq('user_id', DEFAULT_CUSTOMER_ID)
      .single()

    res.json({ allowed_payment_methods: data?.allowed_payment_methods ?? null })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// PATCH /api/users/default-payment-methods — update default payment methods
router.patch('/default-payment-methods', async (req: Request, res: Response) => {
  try {
    const { allowed_payment_methods } = req.body

    if (!Array.isArray(allowed_payment_methods)) {
      res.status(400).json({ message: 'allowed_payment_methods must be an array' })
      return
    }

    const { data, error } = await supabase
      .from('user_roles')
      .upsert(
        {
          user_id: DEFAULT_CUSTOMER_ID,
          email: 'default-customer@system',
          role: 'customer',
          allowed_payment_methods,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (error) throw error
    await logAudit(req, { action: 'update', entity: 'user_role', entity_id: DEFAULT_CUSTOMER_ID, details: { allowed_payment_methods } })
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// GET /api/users — list all user roles
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { data: roles, error } = await supabase
      .from('user_roles')
      .select('*')
      .neq('user_id', DEFAULT_CUSTOMER_ID)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Try to enrich with auth data (banned status, last login) — non-blocking
    let merged = roles ?? []
    try {
      const { data: { users: authUsers } } = await supabase.auth.admin.listUsers()
      if (authUsers) {
        const authMap = new Map(authUsers.map((u) => [u.id, u]))
        merged = (roles ?? []).map((r: any) => {
          const authUser = authMap.get(r.user_id)
          return {
            ...r,
            is_banned: authUser?.banned_until ? new Date(authUser.banned_until) > new Date() : false,
            last_sign_in: authUser?.last_sign_in_at ?? null,
          }
        })
      }
    } catch {
      // Auth enrichment failed — return roles without auth data
    }

    res.json(merged)
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

// PATCH /api/users/profile/:userId — customer updates their own profile
router.patch('/profile/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    const { full_name, phone, plate_number, home_lat, home_lng, home_address } = req.body

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (full_name !== undefined) updates.full_name = String(full_name).trim().slice(0, 100) || null
    if (phone !== undefined) updates.phone = String(phone).trim().slice(0, 20) || null
    if (plate_number !== undefined) updates.plate_number = String(plate_number).trim().toUpperCase().slice(0, 20) || null
    if (home_lat !== undefined) updates.home_lat = home_lat === null ? null : Number(home_lat)
    if (home_lng !== undefined) updates.home_lng = home_lng === null ? null : Number(home_lng)
    if (home_address !== undefined) updates.home_address = home_address ? String(home_address).trim().slice(0, 500) : null

    const { data, error } = await supabase
      .from('user_roles')
      .update(updates)
      .eq('user_id', userId)
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
    await logAudit(req, { action: 'update', entity: 'user_role', entity_id: id, details: {
      page: 'Users',
      email: data.email,
      changes: Object.entries(updates).filter(([k]) => k !== 'updated_at').map(([k, v]) => {
        if (k === 'role') return `Role → ${v}`
        if (k === 'allowed_pages') return `Page access → ${Array.isArray(v) ? v.join(', ') : v}`
        if (k === 'allowed_payment_methods') return `Payment methods → ${Array.isArray(v) ? v.join(', ') : v}`
        return `${k} → ${v}`
      }).join('; '),
    } })
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// PATCH /api/users/:id/password — change user password
router.patch('/:id/password', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { password } = req.body

    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters' })
      return
    }

    // Get user_id from user_roles record
    const { data: roleRecord } = await supabase
      .from('user_roles')
      .select('user_id, email')
      .eq('id', id)
      .single()

    if (!roleRecord) {
      res.status(404).json({ message: 'User not found' })
      return
    }

    const { error } = await supabase.auth.admin.updateUserById(roleRecord.user_id, { password })
    if (error) throw error

    await logAudit(req, { action: 'update', entity: 'user_role', entity_id: id, details: { page: 'Users', email: roleRecord.email, changes: 'Password changed' } })
    res.json({ message: 'Password updated' })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// PATCH /api/users/:id/toggle-ban — enable/disable user account
router.patch('/:id/toggle-ban', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { ban } = req.body // true = disable, false = enable

    const { data: roleRecord } = await supabase
      .from('user_roles')
      .select('user_id, email')
      .eq('id', id)
      .single()

    if (!roleRecord) {
      res.status(404).json({ message: 'User not found' })
      return
    }

    if (ban) {
      // Ban until year 2099
      const { error } = await supabase.auth.admin.updateUserById(roleRecord.user_id, {
        ban_duration: '876000h',
      })
      if (error) throw error
    } else {
      const { error } = await supabase.auth.admin.updateUserById(roleRecord.user_id, {
        ban_duration: 'none',
      })
      if (error) throw error
    }

    await logAudit(req, { action: 'update', entity: 'user_role', entity_id: id, details: { page: 'Users', email: roleRecord.email, changes: ban ? 'Account disabled' : 'Account enabled' } })
    res.json({ message: ban ? 'Account disabled' : 'Account enabled' })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/users/account/:userId — customer deletes their own account (UAE PDPL compliance)
router.delete('/account/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params

    // Get user info before deletion for audit
    const { data: roleRecord } = await supabase
      .from('user_roles')
      .select('email')
      .eq('user_id', userId)
      .single()

    // 1. Delete user_roles record (removes PII: name, phone, plate, location)
    await supabase.from('user_roles').delete().eq('user_id', userId)

    // 2. Anonymize orders (keep for business records, strip PII)
    await supabase
      .from('orders')
      .update({ customer_email: null, customer_name: 'Deleted User', notes: null })
      .eq('customer_id', userId)

    // 3. Delete from Supabase Auth
    await supabase.auth.admin.deleteUser(String(userId))

    // 4. Audit log
    await logAudit(req, {
      action: 'delete',
      entity: 'user_account',
      entity_id: userId,
      details: { email: roleRecord?.email, reason: 'Self-service account deletion (PDPL)' },
    })

    res.json({ message: 'Account deleted successfully' })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

// DELETE /api/users/:id — remove a user role record
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { data: existing } = await supabase.from('user_roles').select('email, role').eq('id', id).single()
    const { error } = await supabase.from('user_roles').delete().eq('id', id)
    if (error) throw error
    await logAudit(req, { action: 'delete', entity: 'user_role', entity_id: id, details: { page: 'Users', email: existing?.email, role: existing?.role } })
    res.json({ message: 'User role deleted' })
  } catch (err: any) {
    res.status(500).json({ message: err.message })
  }
})

export default router
