import client from './client'
import type { AiChatResult, DraftPost, SearchAdvice } from '../types'
import type { CircleGeometry, PolylineGeometry } from './items'

export interface SearchAdviceInput {
  item_id?: string | null
  geometry?: CircleGeometry | PolylineGeometry | null
  category?: string | null
}

export async function aiChat(
  message: string,
  page?: string,
  action?: 'draft',
): Promise<AiChatResult> {
  const res = await client.post<AiChatResult>('/ai/chat', { message, page, action })
  return res.data
}

export async function suggestLocations(keyword?: string): Promise<string[]> {
  const res = await client.get<{ locations: string[] }>('/ai/suggest-locations', {
    params: keyword ? { keyword } : undefined,
  })
  return res.data.locations
}

export async function draftPost(text: string): Promise<DraftPost> {
  const res = await client.post<DraftPost>('/ai/draft-post', { text })
  return res.data
}

export async function searchAdvice(body: SearchAdviceInput): Promise<SearchAdvice> {
  const res = await client.post<SearchAdvice>('/ai/search-advice', body)
  return res.data
}