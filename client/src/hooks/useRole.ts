import { useState, useEffect } from 'react'
import { useAuth } from './useAuth'
import type { UserRole } from '../types'
import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '' })

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
      try {
        // Calls server which auto-creates a customer record if none exists
        const { data } = await api.get(`/api/users/role/${user.id}`, {
          params: { email: user.email },
        })
        setRole((data.role as UserRole) ?? 'customer')
        setAllowedPages(data.allowed_pages ?? null)
        setAllowedPaymentMethods(data.allowed_payment_methods ?? null)
      } catch {
        setRole('customer')
        setAllowedPages(null)
        setAllowedPaymentMethods(null)
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
