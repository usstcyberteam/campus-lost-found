import client from './client'
import type { HelperState } from '../types'

export async function takeHelper(itemId: string): Promise<HelperState> {
  const res = await client.post<HelperState>(`/items/${itemId}/helpers`)
  return res.data
}

export async function abandonHelper(itemId: string): Promise<HelperState> {
  const res = await client.delete<HelperState>(`/items/${itemId}/helpers`)
  return res.data
}

export async function thankHelpers(itemId: string, helperIds: string[]): Promise<{ thanked_count: number }> {
  const res = await client.post<{ thanked_count: number }>(`/items/${itemId}/thank`, { helper_ids: helperIds })
  return res.data
}