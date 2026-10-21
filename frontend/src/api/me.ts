import client from './client'
import type { Badge, HelpingItem, Item, MyClaim, MyComment, Page, Ticket } from '../types'

export interface ListParams {
  limit?: number
  offset?: number
}

export async function listMyItems(params: ListParams = {}): Promise<Page<Item>> {
  const res = await client.get<Page<Item>>('/me/items', { params })
  return res.data
}

export async function listMyClaims(params: ListParams = {}): Promise<Page<MyClaim>> {
  const res = await client.get<Page<MyClaim>>('/me/claims', { params })
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

export async function listMyFavorites(params: ListParams = {}): Promise<Page<Item>> {
  const res = await client.get<Page<Item>>('/me/favorites', { params })
  return res.data
}

export async function listMyLikes(params: ListParams = {}): Promise<Page<Item>> {
  const res = await client.get<Page<Item>>('/me/likes', { params })
  return res.data
}

export async function listMyComments(params: ListParams = {}): Promise<Page<MyComment>> {
  const res = await client.get<Page<MyComment>>('/me/comments', { params })
  return res.data
}

export async function listMyHelping(params: ListParams = {}): Promise<Page<HelpingItem>> {
  const res = await client.get<Page<HelpingItem>>('/me/helping', { params })
  return res.data
}