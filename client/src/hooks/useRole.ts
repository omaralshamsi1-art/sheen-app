import { useState, useEffect } from 'react'
import { useAuth } from './useAuth'
import type { UserRole } from '../types'
import api from '../lib/api'

export function useRole() {
  const { user } = useAuth()
  const [role, setRole] = useState<UserRole | null>(null)
  const [allowedPages, setAllowedPages] = useState<string[] | null>(null)
  const [allowedPaymentMethods, setAllowedPaymentMethods] = useState<string[] | null>(null)
  const [plateNumber, setPlateNumber] = useState<string | null>(null)
  const [phone, setPhone] = useState<string | null>(null)
  const [fullName, setFullName] = useState<string | null>(null)
  const [roleRecordId, setRoleRecordId] = useState<string | null>(null)
  const [roleLoading, setRoleLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setRole(null)
      setAllowedPages(null)
      setAllowedPaymentMethods(null)
      setPlateNumber(null)
      setPhone(null)
      setFullName(null)
      setRoleRecordId(null)
      setRoleLoading(false)
      return
    }

    const fetchRole = async () => {
      setRoleLoading(true)
      try {
        const { data } = await api.get(`/api/users/role/${user.id}`, {
          params: { email: user.email },
        })
        setRole((data.role as UserRole) ?? 'customer')
        setAllowedPages(data.allowed_pages ?? null)
        setAllowedPaymentMethods(data.allowed_payment_methods ?? null)
        setPlateNumber(data.plate_number || null)
        setPhone(data.phone || null)
        setFullName(data.full_name || null)
        setRoleRecordId(data.id ?? null)
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

  return { role, roleLoading, isAdmin, isStaff, isCustomer, allowedPages, allowedPaymentMethods, plateNumber, phone, fullName, roleRecordId }
}
