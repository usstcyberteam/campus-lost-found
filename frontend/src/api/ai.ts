import client from './client'
import type { AiChatResult, DraftPost, SearchAdvice } from '../types'
import type { CircleGeometry, PolylineGeometry } from './items'

export interface SearchAdviceInput {
  item_id?: string | null
  geometry?: CircleGeometry | PolylineGeometry | null
  category?: string | null
}

export interface ChatHistoryItem {
  role: 'user' | 'assistant'
  text: string
  // 思考模式多轮上下文：原样回传上一轮 reasoning_content，后端组装标准 assistant 消息
  reasoning_content?: string | null
}

export type ChatAction = 'draft' | 'polish' | 'translate'
export type TranslateTargetLang = 'en' | 'ja' | 'ko'

export async function aiChat(
  message: string,
  page?: string,
  action?: ChatAction,
  history?: ChatHistoryItem[],
  targetLang?: TranslateTargetLang,
): Promise<AiChatResult> {
  const res = await client.post<AiChatResult>('/ai/chat', {
    message,
    page,
    action,
    history,
    // action=translate：text 与 message 同值承载待译原文，target_lang 指定目标语言
    text: action === 'translate' ? message : undefined,
    target_lang: targetLang,
  })
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