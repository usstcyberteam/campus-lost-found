import client from './client'
import type { Claim, ClaimDetail, ClaimStatus, EvidenceKind, Page } from '../types'

export interface EvidenceInput {
  kind: EvidenceKind
  content: string
}

export interface ClaimCreateInput {
  found_item_id: string
  lost_item_id?: string | null
  evidence: EvidenceInput[]
  idempotency_key: string
}

export interface ReviewInput {
  approve: boolean
  reason?: string | null
}

export interface ListClaimsParams {
  status?: ClaimStatus | null
  limit?: number
  offset?: number
}

export async function listClaims(params: ListClaimsParams = {}): Promise<Page<Claim>> {
  const res = await client.get<Page<Claim>>('/claims', { params })
  return res.data
}

export async function getClaim(id: string): Promise<ClaimDetail> {
  const res = await client.get<ClaimDetail>(`/claims/${id}`)
  return res.data
}

export async function createClaim(body: ClaimCreateInput): Promise<Claim> {
  const res = await client.post<Claim>('/claims', body)
  return res.data
}

export async function reviewClaim(id: string, body: ReviewInput): Promise<Claim> {
  const res = await client.post<Claim>(`/claims/${id}/review`, body)
  return res.data
}

export async function completeClaim(id: string): Promise<Claim> {
  const res = await client.post<Claim>(`/claims/${id}/complete`)
  return res.data
}