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

export async function changeUserPassword(id: string, password: string): Promise<void> {
  await api.patch(`/api/users/${id}/password`, { password })
}

export async function toggleUserBan(id: string, ban: boolean): Promise<void> {
  await api.patch(`/api/users/${id}/toggle-ban`, { ban })
}

export async function getDefaultPaymentMethods(): Promise<string[] | null> {
  const { data } = await api.get('/api/users/default-payment-methods')
  return data.allowed_payment_methods
}

export async function updateDefaultPaymentMethods(allowed_payment_methods: string[]): Promise<void> {
  await api.patch('/api/users/default-payment-methods', { allowed_payment_methods })
}
