import { createContext, useContext } from 'react'
import type { Map as LeafletMap, LatLng } from 'leaflet'
import type { Layer } from '../../types'

export interface CampusMapContextValue {
  map: LeafletMap | null
  layer: Layer
  toMap: (nx: number, ny: number) => LatLng
  toNorm: (latlng: LatLng) => { x: number; y: number }
}

export const CampusMapContext = createContext<CampusMapContextValue | null>(null)

export function useCampusMap(): CampusMapContextValue {
  const ctx = useContext(CampusMapContext)
  if (!ctx) throw new Error('useCampusMap 必须在 CampusMap 组件内使用')
  return ctx
}