import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Building } from '../../types'
import { useCampusMap } from './MapContext'
import styles from './BuildingLayer.module.css'

interface BuildingLayerProps {
  buildings: Building[]
  selectedId: string | null
  onSelect: (building: Building) => void
  interactive?: boolean
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[char]
  })
}

export function buildingCenter(building: Building): { x: number; y: number } | null {
  if (building.label_position) {
    return { x: building.label_position.x, y: building.label_position.y }
  }
  const region = building.click_region
  if (!region || region.length === 0) return null
  return {
    x: region.reduce((sum, point) => sum + point.x, 0) / region.length,
    y: region.reduce((sum, point) => sum + point.y, 0) / region.length,
  }
}

function pointInRegion(point: { x: number; y: number }, region: Record<string, number>[]): boolean {
  let inside = false
  for (let i = 0, j = region.length - 1; i < region.length; j = i, i += 1) {
    const xi = region[i].x
    const yi = region[i].y
    const xj = region[j].x
    const yj = region[j].y
    const crosses = yi > point.y !== yj > point.y
    if (crosses && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

// 发布时用绘制点反查建筑：优先命中点击区域，其次取最近的建筑标签
export function buildingAt(point: { x: number; y: number }, buildings: Building[]): Building | null {
  for (const building of buildings) {
    if (building.click_region && building.click_region.length >= 3) {
      if (pointInRegion(point, building.click_region)) return building
    }
  }
  let nearest: Building | null = null
  let best = 0.08
  for (const building of buildings) {
    const center = buildingCenter(building)
    if (!center) continue
    const distance = Math.hypot(center.x - point.x, center.y - point.y)
    if (distance < best) {
      best = distance
      nearest = building
    }
  }
  return nearest
}

export default function BuildingLayer({ buildings, selectedId, onSelect, interactive = true }: BuildingLayerProps) {
  const { map, layer, toMap } = useCampusMap()
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect

  useEffect(() => {
    if (!map) return
    const group = L.layerGroup().addTo(map)
    buildings.forEach((building) => {
      const active = building.id === selectedId
      const region = building.click_region?.map((point) => toMap(point.x, point.y))
      if (region && region.length >= 3) {
        L.polygon(region, {
          color: cssVar('--color-primary'),
          weight: active ? 3 : 1,
          fillColor: cssVar('--color-primary'),
          fillOpacity: active ? 0.3 : 0.12,
          bubblingMouseEvents: false,
          interactive,
        })
          .on('click', () => selectRef.current(building))
          .addTo(group)
      }
      const center = buildingCenter(building)
      if (!center) return
      L.marker(toMap(center.x, center.y), {
        icon: L.divIcon({
          className: styles.labelIcon,
          html: `<span>${escapeHtml(building.name)}</span>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        keyboard: true,
        bubblingMouseEvents: false,
        interactive,
      })
        .on('click', () => selectRef.current(building))
        .addTo(group)
    })
    return () => {
      group.remove()
    }
  }, [map, layer, buildings, selectedId, toMap, interactive])

  return null
}