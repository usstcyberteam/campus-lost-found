import client from './client'
import type { Page, Praise } from '../types'

export interface PraiseCreateInput {
  to_user_id: string
  content: string
  item_id?: string | null
}

export interface PraiseUpdateInput {
  content: string
}

export interface ListParams {
  limit?: number
  offset?: number
}

export async function listPraises(params: ListParams = {}): Promise<Page<Praise>> {
  const res = await client.get<Page<Praise>>('/praises', { params })
  return res.data
}

export async function createPraise(body: PraiseCreateInput): Promise<Praise> {
  const res = await client.post<Praise>('/praises', body)
  return res.data
}

export async function updatePraise(id: string, body: PraiseUpdateInput): Promise<Praise> {
  const res = await client.patch<Praise>(`/praises/${id}`, body)
  return res.data
}

export async function deletePraise(id: string): Promise<{ ok: boolean }> {
  const res = await client.delete<{ ok: boolean }>(`/praises/${id}`)
  return res.data
}

export interface LookupUserOut {
  id: string
  display_name: string
}

export async function lookupUser(username: string): Promise<LookupUserOut> {
  const res = await client.get<LookupUserOut>('/praises/lookup-user', { params: { username } })
  return res.data
}