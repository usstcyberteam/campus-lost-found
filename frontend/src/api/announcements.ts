import client from './client'
import type { Announcement, AnnouncementFavorite, Page } from '../types'

export interface AnnouncementInput {
  title: string
  content: string
  is_pinned?: boolean
}

export interface AnnouncementUpdateInput {
  title?: string
  content?: string
  is_pinned?: boolean
}

export interface ListParams {
  limit?: number
  offset?: number
}

export async function listAnnouncements(params: ListParams = {}): Promise<Page<Announcement>> {
  const res = await client.get<Page<Announcement>>('/announcements', { params })
  return res.data
}

export async function getAnnouncement(id: string): Promise<Announcement> {
  const res = await client.get<Announcement>(`/announcements/${id}`)
  return res.data
}

export async function createAnnouncement(body: AnnouncementInput): Promise<Announcement> {
  const res = await client.post<Announcement>('/announcements', body)
  return res.data
}

export async function updateAnnouncement(id: string, body: AnnouncementUpdateInput): Promise<Announcement> {
  const res = await client.patch<Announcement>(`/announcements/${id}`, body)
  return res.data
}

export async function deleteAnnouncement(id: string): Promise<{ ok: boolean }> {
  const res = await client.delete<{ ok: boolean }>(`/announcements/${id}`)
  return res.data
}

export async function favoriteAnnouncement(id: string): Promise<Announcement> {
  const res = await client.post<Announcement>(`/announcements/${id}/favorite`)
  return res.data
}

export async function unfavoriteAnnouncement(id: string): Promise<Announcement> {
  const res = await client.delete<Announcement>(`/announcements/${id}/favorite`)
  return res.data
}

export async function listMyAnnouncementFavorites(params: ListParams = {}): Promise<Page<AnnouncementFavorite>> {
  const res = await client.get<Page<AnnouncementFavorite>>('/me/announcement-favorites', { params })
  return res.data
}