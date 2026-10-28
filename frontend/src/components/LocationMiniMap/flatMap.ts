import { getLayerImage, getMapMeta, listLayers } from '../../api/layers'
import type { Layer } from '../../types'

export interface FlatMap {
  layer: Layer
  url: string
}

// 平面底图整站只拉一次：详情页小地图、分享卡片共用，来回切换不重复下载
let flatMapPromise: Promise<FlatMap> | null = null

export function loadFlatMap(): Promise<FlatMap> {
  if (!flatMapPromise) {
    flatMapPromise = Promise.all([getMapMeta(), listLayers()]).then(async ([meta, layers]) => {
      const layer = layers.find((row) => row.id === meta.flat_layer_id)
      if (!layer) throw new Error('缺少室外平面图')
      return { layer, url: URL.createObjectURL(await getLayerImage(layer.id)) }
    })
    flatMapPromise.catch(() => {
      flatMapPromise = null
    })
  }
  return flatMapPromise
}

/** 归一化坐标（原点左下、y 向上）→ 平面图像素坐标（原点左上） */
export function toPixel(layer: Layer, point: { x: number; y: number }): { x: number; y: number } {
  return { x: point.x * layer.width, y: (1 - point.y) * layer.height }
}
