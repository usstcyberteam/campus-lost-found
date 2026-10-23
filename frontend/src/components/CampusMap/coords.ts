import L from 'leaflet'
import type { LatLng } from 'leaflet'
import type { Building } from '../../types'

// 仅依赖图层尺寸的窄接口，避免换算函数与完整 Layer 类型耦合
export interface LayerDims {
  width: number
  height: number
}

export interface NormalizedPoint {
  x: number
  y: number
}

export type FlatToIsoMatrix = [[number, number, number], [number, number, number]]

export const BUILDING_LABEL_MIN_ZOOM = 0.5

const LABEL_HIT_RADIUS = 0.08
let matrixWarned = false

// 归一化坐标转地图坐标：CRS.Simple 下纬度向上增大，归一化原点在图片左下角，x 向右、y 向上，y=1 对应图片顶边
export function normToLatLng(nx: number, ny: number, dims: LayerDims): LatLng {
  return L.latLng(ny * dims.height, nx * dims.width)
}

// 地图坐标转归一化坐标：归一化原点在图片左下角，x 向右、y 向上
export function latLngToNorm(latlng: LatLng, dims: LayerDims): { x: number; y: number } {
  return { x: latlng.lng / dims.width, y: latlng.lat / dims.height }
}

function isMatrix(matrix: FlatToIsoMatrix | null | undefined): matrix is FlatToIsoMatrix {
  if (!Array.isArray(matrix) || matrix.length !== 2) return false
  return matrix.every((row) => Array.isArray(row) && row.length === 3 && row.every((cell) => Number.isFinite(cell)))
}

// 平面归一化坐标 → 2.5D 归一化坐标（2×3 仿射，行优先）；矩阵非法时退化为恒等变换
export function flatToIso(point: NormalizedPoint, matrix: FlatToIsoMatrix): NormalizedPoint {
  if (!isMatrix(matrix)) {
    if (!matrixWarned) {
      console.warn('flat_to_iso 矩阵非法，已退化为恒等变换')
      matrixWarned = true
    }
    return { x: point.x, y: point.y }
  }
  const [[a, b, c], [d, e, f]] = matrix
  return { x: a * point.x + b * point.y + c, y: d * point.x + e * point.y + f }
}

// 多边形命中（射线法，首尾自动闭合；点数 <3 返回 false）
export function pointInRegion(point: NormalizedPoint, region: NormalizedPoint[] | null | undefined): boolean {
  if (!region || region.length < 3) return false
  let inside = false
  for (let index = 0; index < region.length; index += 1) {
    const current = region[index]
    const next = region[(index + 1) % region.length]
    if (current.y > point.y !== next.y > point.y) {
      const cross = ((next.x - current.x) * (point.y - current.y)) / (next.y - current.y) + current.x
      if (point.x < cross) inside = !inside
    }
  }
  return inside
}

function asPoints(region: Record<string, number>[] | null | undefined): NormalizedPoint[] {
  if (!region) return []
  return region
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({ x: point.x, y: point.y }))
}

function priority(building: Building): [number, string] {
  return [building.draw_order, building.code]
}

function pickTop(candidates: Building[]): Building | null {
  if (candidates.length === 0) return null
  return [...candidates].sort((left, right) => {
    const [leftOrder, leftCode] = priority(left)
    const [rightOrder, rightCode] = priority(right)
    if (leftOrder !== rightOrder) return rightOrder - leftOrder
    return leftCode.localeCompare(rightCode)
  })[0]
}

// 平面视图按轮廓取建筑；未命中时取标签附近 0.08 内最近的建筑
export function flatBuildingAt(point: NormalizedPoint, buildings: Building[]): Building | null {
  const hits = buildings.filter((building) => pointInRegion(point, asPoints(building.click_region)))
  const top = pickTop(hits)
  if (top) return top
  let nearest: Building | null = null
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const building of buildings) {
    const label = building.label_position
    if (!label || !Number.isFinite(label.x) || !Number.isFinite(label.y)) continue
    const distance = Math.hypot(point.x - label.x, point.y - label.y)
    if (distance <= LABEL_HIT_RADIUS && distance < nearestDistance) {
      nearest = building
      nearestDistance = distance
    }
  }
  return nearest
}

// 室内视图按 2.5D 命中区取建筑，多个命中取 draw_order 最大
export function isoBuildingAt(point: NormalizedPoint, buildings: Building[]): Building | null {
  const hits = buildings.filter((building) => pointInRegion(point, asPoints(building.iso_hit_area)))
  return pickTop(hits)
}