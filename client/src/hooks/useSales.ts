import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { salesService } from '../services/salesService'
import type { SalePayload } from '../types'
import toast from 'react-hot-toast'

export function useTodaySales() {
  return useQuery({
    queryKey: ['sales', 'today'],
    queryFn: salesService.getTodaySales,
    staleTime: 30_000,
  })
}

export function useSalesByDate(date: string) {
  return useQuery({
    queryKey: ['sales', date],
    queryFn: () => salesService.getSalesByDate(date),
    staleTime: 30_000,
  })
}

export function useSaleItems(saleId: string | null) {
  return useQuery({
    queryKey: ['sale-items', saleId],
    queryFn: () => salesService.getSaleItems(saleId!),
    enabled: !!saleId,
    staleTime: 30_000,
  })
}

export function useRecordSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: SalePayload) => salesService.recordSale(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Sale recorded!')
    },
    onError: () => toast.error('Failed to record sale'),
  })
}

export function useDeleteSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => salesService.deleteSale(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Sale deleted')
    },
    onError: () => toast.error('Failed to delete sale'),
  })
}

export function useDashboardKPIs() {
  return useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => salesService.getDashboardKPIs(),
    staleTime: 30_000,
  })
}

export function useHourlySales(date: string) {
  return useQuery({
    queryKey: ['dashboard', 'hourly', date],
    queryFn: () => salesService.getHourlySales(date),
    staleTime: 30_000,
  })
}

export function useTopSellers(date: string, limit = 5) {
  return useQuery({
    queryKey: ['dashboard', 'top-sellers', date, limit],
    queryFn: () => salesService.getTopSellers(date, limit),
    staleTime: 30_000,
  })
}

export function useLast7DaysRevenue() {
  return useQuery({
    queryKey: ['dashboard', 'last-7-days'],
    queryFn: salesService.getLast7DaysRevenue,
    staleTime: 30_000,
  })
}
