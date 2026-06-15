import api from '../lib/api'
import type { Offer, OfferSlot } from '../types'

export type OfferInput = {
  name: string
  description?: string | null
  price: number
  original_price?: number | null
  discount_percent?: number | null
  category?: string
  menu_item_ids?: string[]
  slots?: OfferSlot[]
  is_active?: boolean
  sort_order?: number
}

/** Active offers for the customer Offers tab. */
export async function getOffers(): Promise<Offer[]> {
  const { data } = await api.get<Offer[]>('/api/offers')
  return data
}

/** Every offer incl. inactive (admin management). */
export async function getAllOffers(): Promise<Offer[]> {
  const { data } = await api.get<Offer[]>('/api/offers', { params: { all: 1 } })
  return data
}

export async function createOffer(input: OfferInput): Promise<Offer> {
  const { data } = await api.post<Offer>('/api/offers', input)
  return data
}

export async function updateOffer(id: string, input: OfferInput): Promise<Offer> {
  const { data } = await api.put<Offer>(`/api/offers/${id}`, input)
  return data
}

export async function deleteOffer(id: string): Promise<void> {
  await api.delete(`/api/offers/${id}`)
}
