import client from './client'
import type { Layer, LayerPoints, MapMeta, SimulatedPoint } from '../types'

export interface CalibrateInput {
  pixels_per_meter: number
}

export interface SimulatedPointInput {
  label: string
  norm_x: number
  norm_y: number
  description?: string | null
}

export async function listLayers(): Promise<Layer[]> {
  const res = await client.get<Layer[]>('/layers')
  return res.data
}

export async function getMapMeta(): Promise<MapMeta> {
  const res = await client.get<MapMeta>('/map/meta')
  return res.data
}

export async function getLayerImage(id: string, signal?: AbortSignal): Promise<Blob> {
  const res = await client.get<Blob>(`/layers/${id}/image`, { responseType: 'blob', signal })
  return res.data
}

export async function calibrateLayer(id: string, body: CalibrateInput): Promise<Layer> {
  const res = await client.post<Layer>(`/layers/${id}/calibrate`, body)
  return res.data
}

export async function listLayerPoints(id: string): Promise<LayerPoints> {
  const res = await client.get<LayerPoints>(`/layers/${id}/points`)
  return res.data
}

export async function listSimulatedPoints(id: string): Promise<SimulatedPoint[]> {
  const res = await client.get<SimulatedPoint[]>(`/layers/${id}/simulated-points`)
  return res.data
}

export async function createSimulatedPoint(id: string, body: SimulatedPointInput): Promise<SimulatedPoint> {
  const res = await client.post<SimulatedPoint>(`/layers/${id}/simulated-points`, body)
  return res.data
}