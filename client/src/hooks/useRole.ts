import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { UserRole } from '../types'

export function useRole() {
  const { user } = useAuth()
  const [role, setRole] = useState<UserRole | null>(null)
  const [roleLoading, setRoleLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setRole(null)
      setRoleLoading(false)
      return
    }

    const fetchRole = async () => {
      setRoleLoading(true)
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (error || !data) {
        // No role found — default to customer
        setRole('customer')
      } else {
        setRole(data.role as UserRole)
      }
      setRoleLoading(false)
    }

    fetchRole()
  }, [user])

  const isAdmin = role === 'admin'
  const isStaff = role === 'staff'
  const isCustomer = role === 'customer'

  return { role, roleLoading, isAdmin, isStaff, isCustomer }
}
