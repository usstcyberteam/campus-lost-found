import client from './client'
import type { Building, Page } from '../types'

export interface ListBuildingsParams {
  category?: string | null
  limit?: number
  offset?: number
}

export async function listBuildings(params: ListBuildingsParams = {}): Promise<Page<Building>> {
  const res = await client.get<Page<Building>>('/buildings', { params })
  return res.data
}

export async function listAllBuildings(
  params: Omit<ListBuildingsParams, 'limit' | 'offset'> = {},
): Promise<Building[]> {
  const collected: Building[] = []
  let offset = 0
  let total = Number.POSITIVE_INFINITY
  while (collected.length < total) {
    const page = await listBuildings({ ...params, limit: 100, offset })
    collected.push(...page.items)
    total = page.total
    if (page.items.length === 0) break
    offset += page.items.length
  }
  return collected
}

export async function getBuilding(id: string): Promise<Building> {
  const res = await client.get<Building>(`/buildings/${id}`)
  return res.data
}