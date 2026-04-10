import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { expenseService } from '../services/expenseService'
import type { ExpensePayload } from '../types'
import toast from 'react-hot-toast'

export function useExpenses(params?: { start?: string; end?: string; category?: string }) {
  return useQuery({
    queryKey: ['expenses', params],
    queryFn: () => expenseService.getExpenses(params),
    staleTime: 30_000,
  })
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ExpensePayload) => expenseService.createExpense(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Expense recorded!')
    },
    onError: () => toast.error('Failed to record expense'),
  })
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, any> }) => expenseService.updateExpense(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense updated')
    },
    onError: () => toast.error('Failed to update expense'),
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => expenseService.deleteExpense(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense deleted')
    },
    onError: () => toast.error('Failed to delete expense'),
  })
}

export function useIngredients() {
  return useQuery({
    queryKey: ['ingredients'],
    queryFn: expenseService.getIngredients,
    staleTime: 60_000,
  })
}

export function useExpenseSummary(params?: { start?: string; end?: string }) {
  return useQuery({
    queryKey: ['expenses', 'summary', params],
    queryFn: () => expenseService.getExpenseSummary(params),
    staleTime: 30_000,
  })
}
