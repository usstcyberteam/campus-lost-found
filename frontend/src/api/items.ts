import client from './client'
import type { Candidate, Direction, Item, ItemStatus, Page, RouteKind, Visibility } from '../types'

export interface ListItemsParams {
  direction?: Direction | null
  category?: string | null
  location_area?: string | null
  status?: ItemStatus | null
  q?: string | null
  building_id?: string | null
  limit?: number
  offset?: number
}

export interface ItemCreateInput {
  direction: Direction
  category: string
  title: string
  description?: string
  location_area?: string
  precise_location?: string | null
  time_occurred?: string | null
  is_simulated?: boolean
  building_id?: string | null
  floor?: number | null
  photo_ids?: string[]
}

export interface MapAnchorInput {
  layer_id: string
  norm_x: number
  norm_y: number
  is_simulated?: boolean
}

export interface RoutePoint {
  x: number
  y: number
}

export interface PolylineGeometry {
  points: RoutePoint[]
}

export interface CircleGeometry {
  center: RoutePoint
  radius: number
}

export interface RouteCreateInput {
  kind: RouteKind
  layer_id?: string | null
  geometry?: PolylineGeometry | CircleGeometry | null
  floor_segments?: unknown[] | null
  visibility?: Visibility | null
}

export interface RouteOut {
  id: string
  kind: RouteKind
  visibility: Visibility
}

export interface RouteDetail {
  id: string
  kind: RouteKind
  geometry: Record<string, unknown> | null
  floor_segments: unknown[] | null
  visibility: Visibility
  authorized: boolean
}

export interface FeatureExtractionOut {
  labels: Record<string, unknown> | null
  extracted_text: string | null
  confidence: number | null
  source: string
  degraded: boolean
}

export async function listItems(params: ListItemsParams = {}): Promise<Page<Item>> {
  const res = await client.get<Page<Item>>('/items', { params })
  return res.data
}

export async function getItem(id: string): Promise<Item> {
  const res = await client.get<Item>(`/items/${id}`)
  return res.data
}

export async function createItem(body: ItemCreateInput): Promise<Item> {
  const res = await client.post<Item>('/items', body)
  return res.data
}

export async function withdrawItem(id: string): Promise<Item> {
  const res = await client.post<Item>(`/items/${id}/withdraw`)
  return res.data
}

export async function markItemFound(id: string): Promise<Item> {
  const res = await client.post<Item>(`/items/${id}/mark-found`)
  return res.data
}

export async function setMapAnchor(id: string, body: MapAnchorInput): Promise<{ ok: boolean }> {
  const res = await client.post<{ ok: boolean }>(`/items/${id}/map-anchor`, body)
  return res.data
}

export async function createRoute(id: string, body: RouteCreateInput): Promise<RouteOut> {
  const res = await client.post<RouteOut>(`/items/${id}/route`, body)
  return res.data
}

export async function getRoutes(id: string): Promise<RouteDetail[]> {
  const res = await client.get<RouteDetail[]>(`/items/${id}/route`)
  return res.data
}

export async function extractFeatures(id: string, text: string | null): Promise<FeatureExtractionOut> {
  const res = await client.post<FeatureExtractionOut>(`/items/${id}/extract`, { text })
  return res.data
}

export async function getCandidates(id: string): Promise<Candidate[]> {
  const res = await client.get<Candidate[]>(`/items/${id}/candidates`)
  return res.data
}