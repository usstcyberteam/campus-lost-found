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