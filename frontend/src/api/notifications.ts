import client from './client'
import type { NotificationItem, Page } from '../types'

export interface ListParams {
  limit?: number
  offset?: number
}

export async function listMyNotifications(params: ListParams = {}): Promise<Page<NotificationItem>> {
  const res = await client.get<Page<NotificationItem>>('/me/notifications', { params })
  return res.data
}
export async function getUnreadNotificationCount(): Promise<number> {
  const res = await client.get<{ count: number }>('/me/notifications/unread-count')
  return res.data.count
}

export async function markNotificationRead(id: string): Promise<NotificationItem> {
  const res = await client.post<NotificationItem>(`/me/notifications/${id}/read`)
  return res.data
}