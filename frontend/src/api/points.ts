import client from './client'
import type { Page } from '../types'

export type PointReason = 'thank' | 'return' | 'ticket_feedback'

export interface PointRecord {
  id: string
  reason: PointReason
  amount: number
  ref_id: string
  created_at: string
}

export interface MyPoints {
  total: number
  title: string
  next_title: string | null
  next_threshold: number | null
  records: Page<PointRecord>
}

export async function getMyPoints(params: { limit?: number; offset?: number } = {}): Promise<MyPoints> {
  const res = await client.get<MyPoints>('/me/points', { params })
  return res.data
}