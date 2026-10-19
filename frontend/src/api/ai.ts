import client from './client'
import type { DraftPost, SearchAdvice } from '../types'
import type { CircleGeometry, PolylineGeometry } from './items'

export interface SearchAdviceInput {
  item_id?: string | null
  geometry?: CircleGeometry | PolylineGeometry | null
  category?: string | null
}

export async function draftPost(text: string): Promise<DraftPost> {
  const res = await client.post<DraftPost>('/ai/draft-post', { text })
  return res.data
}

export async function searchAdvice(body: SearchAdviceInput): Promise<SearchAdvice> {
  const res = await client.post<SearchAdvice>('/ai/search-advice', body)
  return res.data
}