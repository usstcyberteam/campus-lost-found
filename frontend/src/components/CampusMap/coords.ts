import L from 'leaflet'
import type { LatLng } from 'leaflet'

// 仅依赖图层尺寸的窄接口，避免换算函数与完整 Layer 类型耦合
export interface LayerDims {
  width: number
  height: number
}

// 归一化坐标转地图坐标：CRS.Simple 下纬度向上增大，归一化原点在图片左下角，x 向右、y 向上，y=1 对应图片顶边
export function normToLatLng(nx: number, ny: number, dims: LayerDims): LatLng {
  return L.latLng(ny * dims.height, nx * dims.width)
}

// 地图坐标转归一化坐标：归一化原点在图片左下角，x 向右、y 向上
export function latLngToNorm(latlng: LatLng, dims: LayerDims): { x: number; y: number } {
  return { x: latlng.lng / dims.width, y: latlng.lat / dims.height }
}