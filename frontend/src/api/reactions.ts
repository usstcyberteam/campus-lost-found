import client from './client'
import type { Reaction } from '../types'

export async function likeItem(itemId: string): Promise<Reaction> {
  const res = await client.post<Reaction>(`/items/${itemId}/like`)
  return res.data
}

export async function unlikeItem(itemId: string): Promise<Reaction> {
  const res = await client.delete<Reaction>(`/items/${itemId}/like`)
  return res.data
}

export async function favoriteItem(itemId: string): Promise<Reaction> {
  const res = await client.post<Reaction>(`/items/${itemId}/favorite`)
  return res.data
}

export async function unfavoriteItem(itemId: string): Promise<Reaction> {
  const res = await client.delete<Reaction>(`/items/${itemId}/favorite`)
  return res.data
}