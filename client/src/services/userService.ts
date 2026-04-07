import api from '../lib/api'
import type { UserRole, UserRoleRecord } from '../types'

export async function getUsers(): Promise<UserRoleRecord[]> {
  const { data } = await api.get('/api/users')
  return data
}

export async function addUser(email: string, role: UserRole, password?: string): Promise<UserRoleRecord> {
  const { data } = await api.post('/api/users', { email, role, password })
  return data
}

export async function updateUserRole(id: string, role: UserRole): Promise<UserRoleRecord> {
  const { data } = await api.patch(`/api/users/${id}`, { role })
  return data
}

export async function updateUserPages(id: string, allowed_pages: string[]): Promise<UserRoleRecord> {
  const { data } = await api.patch(`/api/users/${id}`, { allowed_pages })
  return data
}

export async function updateUserPaymentMethods(id: string, allowed_payment_methods: string[]): Promise<UserRoleRecord> {
  const { data } = await api.patch(`/api/users/${id}`, { allowed_payment_methods })
  return data
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/api/users/${id}`)
}
