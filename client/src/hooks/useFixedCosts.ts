import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import type { FixedCost, FixedCostPayload, MenuItem } from '../types'
import toast from 'react-hot-toast'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '' })

export function useFixedCosts(month?: string) {
  return useQuery({
    queryKey: ['fixed-costs', month],
    queryFn: async () => {
      const params = month ? { month } : {}
      const { data } = await api.get<FixedCost[]>('/api/fixed-costs', { params })
      return data
    },
    staleTime: 30_000,
  })
}

export function useCreateFixedCost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: FixedCostPayload) => {
      const { data } = await api.post<FixedCost>('/api/fixed-costs', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fixed-costs'] })
      toast.success('Fixed cost added!')
    },
    onError: () => toast.error('Failed to add fixed cost'),
  })
}

export function useTogglePaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_paid }: { id: string; is_paid: boolean }) => {
      const { data } = await api.patch<FixedCost>(`/api/fixed-costs/${id}`, {
        is_paid,
        paid_date: is_paid ? new Date().toISOString().split('T')[0] : null,
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fixed-costs'] })
      toast.success('Updated!')
    },
    onError: () => toast.error('Failed to update'),
  })
}

export function useDeleteFixedCost() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/fixed-costs/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fixed-costs'] })
      toast.success('Deleted')
    },
    onError: () => toast.error('Failed to delete'),
  })
}

export function useMenuItems() {
  return useQuery({
    queryKey: ['menu-items'],
    queryFn: async () => {
      const { data } = await api.get<MenuItem[]>('/api/menu')
      return data
    },
    staleTime: 60_000,
  })
}
