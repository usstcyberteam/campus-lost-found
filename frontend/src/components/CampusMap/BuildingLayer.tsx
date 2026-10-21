import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import type { LeafletMouseEvent } from 'leaflet'
import type { Building, Room } from '../../types'
import { BUILDING_LABEL_MIN_ZOOM, flatBuildingAt, pointInRegion } from './coords'
import { useCampusMap } from './MapContext'
import styles from './BuildingLayer.module.css'

const UNNAMED_BUILDING = '未命名建筑'
const HOVER_GAP = 14
const NO_CODES: string[] = []
const NO_ROOMS: Room[] = []

interface BuildingLayerProps {
  buildings: Building[]
  selectedId: string | null
  recommendedCodes?: string[]
  showLabels?: boolean
  focus?: { buildingId: string; nonce: number } | null
  rooms?: Room[]
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

// 发布时用绘制点反查建筑，命中规则与平面视图选楼保持一致
export function buildingAt(point: { x: number; y: number }, buildings: Building[]): Building | null {
  return flatBuildingAt(point, buildings)
}

function regionLatLngs(building: Building, toMap: (x: number, y: number) => L.LatLng): L.LatLng[] | null {
  if (!building.click_region || building.click_region.length < 3) return null
  return building.click_region.map((point) => toMap(point.x, point.y))
}

export default function BuildingLayer({
  buildings,
  selectedId,
  recommendedCodes = NO_CODES,
  showLabels = false,
  focus = null,
  rooms = NO_ROOMS,
}: BuildingLayerProps) {
  const { map, layer, toMap, toNorm } = useCampusMap()
  const [zoom, setZoom] = useState<number | null>(null)
  const recommendedRef = useRef(recommendedCodes)
  recommendedRef.current = recommendedCodes

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
    if (!map || !focus) return
    const building = buildings.find((item) => item.id === focus.buildingId)
    if (!building) return
    const region = regionLatLngs(building, toMap)
    if (region) {
      map.fitBounds(L.latLngBounds(region).pad(0.4))
      return
    }
    const center = buildingCenter(building)
    if (center) map.setView(toMap(center.x, center.y), Math.max(map.getZoom(), 0))
  }, [map, focus, buildings, toMap])

  useEffect(() => {
    if (!map) return
    const group = L.layerGroup().addTo(map)
    const primary = cssVar('--color-primary')
    const warning = cssVar('--color-warning')
    const recommended = new Set(recommendedRef.current)
    const labelsVisible = showLabels && zoom !== null && zoom >= BUILDING_LABEL_MIN_ZOOM

    buildings.forEach((building) => {
      const region = regionLatLngs(building, toMap)
      const selected = building.id === selectedId
      if (region && recommended.has(building.code)) {
        L.polygon(region, {
          color: warning,
          weight: 2,
          dashArray: '6 4',
          fillColor: warning,
          fillOpacity: 0.08,
          interactive: false,
        }).addTo(group)
      }
      if (region && selected) {
        L.polygon(region, {
          color: primary,
          weight: 3,
          fillColor: primary,
          fillOpacity: 0.25,
          interactive: false,
        }).addTo(group)
      }

      // 建筑层不再绘制中心点，只按需显示楼名
      if (!labelsVisible || building.name === UNNAMED_BUILDING) return
      const center = buildingCenter(building)
      if (!center) return
      L.marker(toMap(center.x, center.y), {
        icon: L.divIcon({
          className: styles.labelIcon,
          html: `<span>${escapeHtml(building.name)}</span>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        keyboard: false,
        interactive: false,
      }).addTo(group)
    })

    rooms.forEach((room) => {
      L.marker(toMap(room.x, room.y), {
        icon: L.divIcon({
          className: styles.roomIcon,
          html: `<span>${escapeHtml(room.name)}</span>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        keyboard: false,
        interactive: false,
      }).addTo(group)
    })

    return () => {
      group.remove()
    }
  }, [map, layer, buildings, selectedId, recommendedCodes, showLabels, zoom, toMap, rooms])

  useEffect(() => {
    if (!map) return
    const container = map.getContainer()
    const tip = document.createElement('div')
    tip.className = styles.hoverTip
    tip.hidden = true
    container.append(tip)

    const place = (x: number, y: number) => {
      let left = x + HOVER_GAP
      let top = y + HOVER_GAP
      if (left + tip.offsetWidth > container.clientWidth) left = x - tip.offsetWidth - HOVER_GAP
      if (top + tip.offsetHeight > container.clientHeight) top = y - tip.offsetHeight - HOVER_GAP
      tip.style.transform = `translate3d(${left}px, ${top}px, 0)`
    }

    const render = (building: Building) => {
      tip.replaceChildren()
      const name = document.createElement('strong')
      name.textContent = building.name
      const category = document.createElement('span')
      category.textContent = building.category
      const hint = document.createElement('span')
      hint.className = styles.hoverHint
      hint.textContent = '点击查看详情'
      tip.append(name, category, hint)
    }

    const onMove = (event: LeafletMouseEvent) => {
      const point = toNorm(event.latlng)
      const building = flatBuildingAt(point, buildings)
      const region = building?.click_region
      const inRegion = region ? pointInRegion(point, region.map((item) => ({ x: item.x, y: item.y }))) : false
      if (!building || !inRegion) {
        tip.hidden = true
        return
      }
      if (tip.dataset.buildingId !== building.id) {
        render(building)
        tip.dataset.buildingId = building.id
      }
      tip.hidden = false
      place(event.containerPoint.x, event.containerPoint.y)
    }
    const hide = () => {
      tip.hidden = true
    }

    map.on('mousemove', onMove)
    map.on('mouseout', hide)
    container.addEventListener('mouseleave', hide)
    return () => {
      map.off('mousemove', onMove)
      map.off('mouseout', hide)
      container.removeEventListener('mouseleave', hide)
      tip.remove()
    }
  }, [map, buildings, toNorm])

  return null
}