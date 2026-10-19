import client from './client'
import type { Comment, Page } from '../types'

export interface CreateCommentInput {
  content: string
  parent_id?: string | null
  photo_ids?: string[]
}

export async function listComments(
  itemId: string,
  params: { limit?: number; offset?: number } = {},
): Promise<Page<Comment>> {
  const res = await client.get<Page<Comment>>(`/items/${itemId}/comments`, { params })
  return res.data
}

export async function createComment(itemId: string, body: CreateCommentInput): Promise<Comment> {
  const res = await client.post<Comment>(`/items/${itemId}/comments`, body)
  return res.data
}

export async function deleteComment(commentId: string): Promise<{ id: string; is_deleted: boolean }> {
  const res = await client.delete<{ id: string; is_deleted: boolean }>(`/comments/${commentId}`)
  return res.data
}