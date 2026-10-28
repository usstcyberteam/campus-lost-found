import client from './client'
import type { Badge, HelpingItem, Item, MyClaim, MyComment, Page, Ticket, User } from '../types'

export interface ListParams {
  limit?: number
  offset?: number
}

export interface ProfileInput {
  display_name?: string
  contact?: string | null
}

export interface PasswordInput {
  old_password: string
  new_password: string
}

export async function uploadAvatar(file: File): Promise<User> {
  const form = new FormData()
  form.append('file', file)
  const res = await client.post<User>('/me/avatar', form)
  return res.data
}

export async function deleteAvatar(): Promise<User> {
  const res = await client.delete<User>('/me/avatar')
  return res.data
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

export async function updateProfile(body: ProfileInput): Promise<User> {
  const res = await client.patch<User>('/me', body)
  return res.data
}

export async function changePassword(body: PasswordInput): Promise<User> {
  const res = await client.post<User>('/me/password', body)
  return res.data
}
