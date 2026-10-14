import client from './client'
import type { Badge, Claim, Item, Page, Ticket } from '../types'

export interface ListParams {
  limit?: number
  offset?: number
}

export async function listMyItems(params: ListParams = {}): Promise<Page<Item>> {
  const res = await client.get<Page<Item>>('/me/items', { params })
  return res.data
}

export async function listMyClaims(params: ListParams = {}): Promise<Page<Claim>> {
  const res = await client.get<Page<Claim>>('/me/claims', { params })
  return res.data
}

export async function listMyTickets(params: ListParams = {}): Promise<Page<Ticket>> {
  const res = await client.get<Page<Ticket>>('/me/tickets', { params })
  return res.data
}

export async function listMyBadges(): Promise<Badge[]> {
  const res = await client.get<Badge[]>('/me/badges')
  return res.data
}