import { useEffect, useState } from 'react'
import L from 'leaflet'
import type { Building, LayerPoint } from '../../types'
import { BUILDING_LABEL_MIN_ZOOM, flatToIso, type FlatToIsoMatrix } from './coords'
import { buildingCenter } from './BuildingLayer'
import { useCampusMap } from './MapContext'
import styles from './IsoBuildingLayer.module.css'

const UNNAMED_BUILDING = '未命名建筑'
const NO_CODES: string[] = []
const NO_POINTS: LayerPoint[] = []
const IDENTITY_MATRIX: FlatToIsoMatrix = [
  [1, 0, 0],
  [0, 1, 0],
]

interface IsoBuildingLayerProps {
  buildings: Building[]
  matrix: FlatToIsoMatrix | null
  selectedId: string | null
  recommendedCodes?: string[]
  showLabels?: boolean
  monitorPoints?: LayerPoint[]
  canSeeMonitor?: boolean
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

export default function IsoBuildingLayer({
  buildings,
  matrix,
  selectedId,
  recommendedCodes = NO_CODES,
  showLabels = false,
  monitorPoints = NO_POINTS,
  canSeeMonitor = false,
}: IsoBuildingLayerProps) {
  const { map, layer, toMap } = useCampusMap()
  const [zoom, setZoom] = useState<number | null>(null)

  useEffect(() => {
    if (!map) return
    const sync = () => setZoom(map.getZoom())
    sync()
    map.on('zoomend', sync)
    return () => {
      map.off('zoomend', sync)
    }
  }, [map])

  useEffect(() => {
    if (!map) return
    const primary = cssVar('--color-primary')
    const warning = cssVar('--color-warning')
    const recommended = new Set(recommendedCodes)
    const labelsVisible = showLabels && zoom !== null && zoom >= BUILDING_LABEL_MIN_ZOOM
    const transform = (point: { x: number; y: number }) => flatToIso(point, matrix ?? IDENTITY_MATRIX)
    const group = L.layerGroup().addTo(map)

    const isoPoint = (building: Building): { x: number; y: number } | null => {
      if (building.iso_label_position) {
        return { x: building.iso_label_position.x, y: building.iso_label_position.y }
      }
      const center = buildingCenter(building)
      return center ? transform(center) : null
    }

    buildings.forEach((building) => {
      const region = building.iso_hit_area
      const isRecommended = recommended.has(building.code)
      const selected = building.id === selectedId

      if (region && region.length >= 3) {
        const latlngs = region.map((point) => toMap(point.x, point.y))
        if (isRecommended) {
          L.polygon(latlngs, {
            color: warning,
            weight: 2,
            dashArray: '6 4',
            fillColor: warning,
            fillOpacity: 0.08,
            interactive: false,
          }).addTo(group)
        }
        if (selected) {
          L.polygon(latlngs, {
            color: primary,
            weight: 3,
            fillColor: primary,
            fillOpacity: 0.25,
            interactive: false,
          }).addTo(group)
        }
      }

      const point = isoPoint(building)
      if (!point) return

      if (!region && (selected || isRecommended)) {
        L.circleMarker(toMap(point.x, point.y), {
          radius: 8,
          color: selected ? primary : warning,
          weight: 2,
          fillColor: selected ? primary : warning,
          fillOpacity: 0.2,
          interactive: false,
        }).addTo(group)
      }

      if (labelsVisible && building.name !== UNNAMED_BUILDING) {
        L.marker(toMap(point.x, point.y), {
          icon: L.divIcon({
            className: styles.labelIcon,
            html: `<span>${escapeHtml(building.name)}</span>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
          keyboard: false,
          interactive: false,
        }).addTo(group)
      }

      if (building.active_item_count > 0) {
        L.marker(toMap(point.x, point.y), {
          icon: L.divIcon({
            className: styles.badgeIcon,
            html: `<span aria-label="${escapeHtml(building.name)}进行中 ${building.active_item_count} 条">${building.active_item_count}</span>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
          keyboard: false,
          interactive: false,
        }).addTo(group)
      }
    })

    if (canSeeMonitor) {
      monitorPoints
        .filter((point) => point.kind === 'monitor_point')
        .forEach((point) => {
          const iso = transform({ x: point.norm_x, y: point.norm_y })
          L.marker(toMap(iso.x, iso.y), {
            icon: L.divIcon({
              className: styles.monitorIcon,
              html: '<span>监</span>',
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            }),
            keyboard: true,
            bubblingMouseEvents: false,
          })
            .bindTooltip(`${point.label}（模拟）`)
            .addTo(group)
        })
    }

    return () => {
      group.remove()
    }
  }, [
    map,
    layer,
    buildings,
    matrix,
    selectedId,
    recommendedCodes,
    showLabels,
    zoom,
    monitorPoints,
    canSeeMonitor,
    toMap,
  ])

  return null
}