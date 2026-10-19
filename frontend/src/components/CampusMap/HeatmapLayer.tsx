import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import type { Building, Item } from '../../types'
import { buildingCenter } from './BuildingLayer'
import { useCampusMap } from './MapContext'

interface HeatmapLayerProps {
  buildings: Building[]
  items: Item[]
}

const EMPTY_COUNTS = new Map<string, number>()

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export default function HeatmapLayer({ buildings, items }: HeatmapLayerProps) {
  const { map, layer, toMap } = useCampusMap()

  // 按建筑聚合进行中帖子数；数据量固定在一次列表请求内，聚合结果复用避免重复计数
  const counts = useMemo(() => {
    if (items.length === 0) return EMPTY_COUNTS
    const tally = new Map<string, number>()
    items.forEach((item) => {
      if (!item.building_id) return
      tally.set(item.building_id, (tally.get(item.building_id) ?? 0) + 1)
    })
    return tally
  }, [items])

  useEffect(() => {
    if (!map || counts.size === 0) return
    const max = Math.max(...counts.values())
    const group = L.layerGroup().addTo(map)
    buildings.forEach((building) => {
      const count = counts.get(building.id) ?? 0
      const center = count > 0 ? buildingCenter(building) : null
      if (!center) return
      const ratio = count / max
      L.circle(toMap(center.x, center.y), {
        radius: layer.height * (0.03 + ratio * 0.04),
        color: ratio >= 0.6 ? cssVar('--color-danger') : cssVar('--color-warning'),
        weight: 1,
        fillColor: ratio >= 0.6 ? cssVar('--color-danger') : cssVar('--color-warning'),
        fillOpacity: 0.2 + ratio * 0.35,
      })
        .bindTooltip(`${building.name}：${count} 条进行中记录（按帖子数聚合，非实时热力）`)
        .bindPopup(`${building.name}：${count} 条进行中记录`)
        .addTo(group)
    })
    return () => {
      group.remove()
    }
  }, [map, layer, buildings, counts, toMap])

  return null
}