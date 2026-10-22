import client from './client'
import type { Page, StaffApplication, StaffStatus, User } from '../types'

export interface StaffApplicationInput {
  staff_no: string
  department?: string | null
}

export interface ListStaffApplicationsParams {
  status?: StaffStatus
  limit?: number
  offset?: number
}

export async function applyStaffApplication(body: StaffApplicationInput): Promise<User> {
  const res = await client.post<User>('/me/staff-application', body)
  return res.data
}

export async function listStaffApplications(params: ListStaffApplicationsParams = {}): Promise<Page<StaffApplication>> {
  const res = await client.get<Page<StaffApplication>>('/admin/staff-applications', { params })
  return res.data
}

export async function approveStaffApplication(userId: string): Promise<User> {
  const res = await client.post<User>(`/admin/staff-applications/${userId}/approve`)
  return res.data
}

export async function rejectStaffApplication(userId: string, reason: string): Promise<User> {
  const res = await client.post<User>(`/admin/staff-applications/${userId}/reject`, { reason })
  return res.data
}