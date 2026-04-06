import axios from 'axios'
import type { UserRole, UserRoleRecord } from '../types'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '' })

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

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/api/users/${id}`)
}
