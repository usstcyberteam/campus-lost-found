import client from './client'
import type { AdminStats, AdminUser, Page, Role } from '../types'

export interface ListUsersParams {
  q?: string
  role?: Role | null
  limit?: number
  offset?: number
}

export interface UpdateUserInput {
  role?: Role
  is_banned?: boolean
}

export async function listUsers(params: ListUsersParams = {}): Promise<Page<AdminUser>> {
  const res = await client.get<Page<AdminUser>>('/admin/users', { params })
  return res.data
}

export async function updateUser(id: string, body: UpdateUserInput): Promise<AdminUser> {
  const res = await client.patch<AdminUser>(`/admin/users/${id}`, body)
  return res.data
}

export async function getStats(): Promise<AdminStats> {
  const res = await client.get<AdminStats>('/admin/stats')
  return res.data
}