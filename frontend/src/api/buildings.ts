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

export async function getBuilding(id: string): Promise<Building> {
  const res = await client.get<Building>(`/buildings/${id}`)
  return res.data
}