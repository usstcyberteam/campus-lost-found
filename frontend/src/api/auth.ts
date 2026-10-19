import client from './client'
import type { Role, User } from '../types'

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  password: string
  display_name: string
  contact?: string | null
  role?: 'student' | 'staff'
  staff_no?: string | null
  department?: string | null
}

export interface TokenResponse {
  token: string
  role: Role
}

export async function login(body: LoginRequest): Promise<TokenResponse> {
  const res = await client.post<TokenResponse>('/auth/login', body)
  return res.data
}

export async function register(body: RegisterRequest): Promise<TokenResponse> {
  const res = await client.post<TokenResponse>('/auth/register', body)
  return res.data
}

export async function me(): Promise<User> {
  const res = await client.get<User>('/auth/me')
  return res.data
}