import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import type { UserRole } from '../types'

export function useRole() {
  const { user } = useAuth()
  const [role, setRole] = useState<UserRole | null>(null)
  const [allowedPages, setAllowedPages] = useState<string[] | null>(null)
  const [allowedPaymentMethods, setAllowedPaymentMethods] = useState<string[] | null>(null)
  const [roleLoading, setRoleLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setRole(null)
      setAllowedPages(null)
      setAllowedPaymentMethods(null)
      setRoleLoading(false)
      return
    }

    const fetchRole = async () => {
      setRoleLoading(true)
      const { data, error } = await supabase
        .from('user_roles')
        .select('role, allowed_pages, allowed_payment_methods')
        .eq('user_id', user.id)
        .single()

      if (error || !data) {
        setRole('customer')
        setAllowedPages(null)
        setAllowedPaymentMethods(null)
      } else {
        setRole(data.role as UserRole)
        setAllowedPages(data.allowed_pages)
        setAllowedPaymentMethods(data.allowed_payment_methods)
      }
      setRoleLoading(false)
    }

    fetchRole()
  }, [user])

  const isAdmin = role === 'admin'
  const isStaff = role === 'staff'
  const isCustomer = role === 'customer'

  return { role, roleLoading, isAdmin, isStaff, isCustomer, allowedPages, allowedPaymentMethods }
}
