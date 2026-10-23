import type { Building } from '../../types'
import type { MapFilterKey } from './MapTopBar'

export interface NormPoint {
  x: number
  y: number
}

// 平面视图的定位锚点：优先标签位置，其次点击区域质心
export function buildingPoint(building: Building): NormPoint | null {
  if (building.label_position) {
    return { x: Number(building.label_position.x), y: Number(building.label_position.y) }
  }
  const region = building.click_region
  if (!region || region.length === 0) return null
  const sum = region.reduce(
    (acc, point) => ({ x: acc.x + Number(point.x), y: acc.y + Number(point.y) }),
    { x: 0, y: 0 },
  )
  return { x: sum.x / region.length, y: sum.y / region.length }
}

// 结果列表：关键词过滤 + 全部/热门/附近 排序
export function selectMapBuildings(
  buildings: Building[],
  query: string,
  filter: MapFilterKey,
  anchor: NormPoint | null,
): Building[] {
  const keyword = query.trim().toLowerCase()
  const list = buildings.filter((building) => {
    if (!keyword) return true
    return (
      building.name.toLowerCase().includes(keyword) ||
      building.code.toLowerCase().includes(keyword) ||
      building.category.toLowerCase().includes(keyword)
    )
  })

  if (filter === 'hot') {
    return [...list].sort((a, b) => b.active_item_count - a.active_item_count)
  }

  if (filter === 'near' && anchor) {
    return [...list].sort((a, b) => {
      const pa = buildingPoint(a)
      const pb = buildingPoint(b)
      const da = pa ? Math.hypot(pa.x - anchor.x, pa.y - anchor.y) : Number.POSITIVE_INFINITY
      const db = pb ? Math.hypot(pb.x - anchor.x, pb.y - anchor.y) : Number.POSITIVE_INFINITY
      return da - db
    })
  }

  return list
}