import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import L from 'leaflet'
import type { Map as LeafletMap } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { errorMessage } from '../../utils/error'
import { getLayerImage } from '../../api/layers'
import type { Layer } from '../../types'
import { CampusMapContext, type CampusMapContextValue } from './MapContext'
import { latLngToNorm, normToLatLng } from './coords'
import styles from './CampusMap.module.css'

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export interface MapMarker {
  x: number
  y: number
  label: string
  color: string
}

export interface CampusMapProps {
  layer: Layer
  markers: MapMarker[]
  onMapClick?: (norm: { x: number; y: number }) => void
  onImageError?: (message: string) => void
  /** 归一化坐标；token 变化即触发一次平滑定位（用于列表点击回定位） */
  focus?: { x: number; y: number; token: number } | null
  children?: ReactNode
}

interface MapInstance {
  map: LeafletMap
  layerId: string
}

export default function CampusMap({ layer, markers, onMapClick, onImageError, focus, children }: CampusMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // 记录实例当前承载的图层：切换视图时子图层仍可能持有旧实例引用，只有与当前图层匹配的实例才交给子图层
  const [instance, setInstance] = useState<MapInstance | null>(null)
  // mapRef 供 effect 读取最新实例，避免闭包拿到已销毁旧实例
  const mapRef = useRef<LeafletMap | null>(null)
  const markerGroupRef = useRef<L.LayerGroup | null>(null)
  const overlayRef = useRef<L.ImageOverlay | null>(null)
  const onClickRef = useRef(onMapClick)
  const onErrorRef = useRef(onImageError)
  const layerRef = useRef(layer)

  onClickRef.current = onMapClick
  onErrorRef.current = onImageError
  layerRef.current = layer

  // 列表点击“回定位”：仅在实例存在时平滑移动，不触碰地图生命周期
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focus) return
    map.panTo(normToLatLng(focus.x, focus.y, layerRef.current))
  }, [focus, instance])

  // 地图实例只在挂载时创建、卸载时销毁：切换图层不重建实例。
  // 否则切换瞬间子图层 effect 会拿到即将被销毁的旧实例并向其添加图层，Leaflet 抛错导致整页白屏。
  useEffect(() => {
    if (!containerRef.current) return
    // 缩放控件放右下：左上已被「室外/室内」切换占用，默认位置会互相遮挡
    const map = L.map(containerRef.current, {
      crs: L.CRS.Simple,
      minZoom: -3,
      maxZoom: 3,
      // 允许 1/4 级缩放：整数级吸附会让"适配全图"偏小一大圈
      zoomSnap: 0.25,
      zoomControl: false,
    })
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    mapRef.current = map
    setInstance({ map, layerId: layerRef.current.id })

    // 点击处理只注册一次，通过 ref 取当前图层做坐标换算
    map.on('click', (e) => {
      onClickRef.current?.(latLngToNorm(e.latlng, layerRef.current))
    })

    return () => {
      mapRef.current = null
      markerGroupRef.current = null
      overlayRef.current = null
      map.remove()
      setInstance(null)
    }
  }, [])

  // 图层切换只更新底图与视野，不销毁地图实例
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let active = true
    let objectUrl: string | null = null
    const controller = new AbortController()

    // 先把实例标记为当前图层，子图层才会拿到有效地图实例
    setInstance({ map, layerId: layer.id })

    const bounds = L.latLngBounds([0, 0], [layer.height, layer.width])
    // 先铺占位矩形，底图缺失或加载失败时地图仍可操作，不会白屏
    const placeholder = L.rectangle(bounds, {
      color: cssVar('--color-border-strong'),
      weight: 1,
      fillOpacity: 0.03,
    }).addTo(map)

    if (layer.image_path) {
      getLayerImage(layer.id, controller.signal)
        .then((blob) => {
          if (!active || mapRef.current !== map) return
          const url = URL.createObjectURL(blob)
          objectUrl = url
          overlayRef.current = L.imageOverlay(url, bounds).addTo(map)
        })
        .catch((e) => {
          if (active) onErrorRef.current?.(errorMessage(e, '底图加载失败'))
        })
    }

    // 地图上方压着搜索栏、下方压着抽屉，视野要避开这两块；与 MapView.module.css 的抽屉高度一致
    const size = map.getSize()
    const topPad = 140
    const bottomPad = size.x < 768 ? 200 : 230
    if (size.x < 768) {
      // 手机竖屏：按屏幕宽度铺满，比"整图塞进剩余高度"大得多，上下拖动查看
      map.setView([layer.height / 2, layer.width / 2], Math.log2((size.x - 16) / layer.width), { animate: false })
      map.panBy([0, (bottomPad - topPad) / 2], { animate: false })
    } else {
      map.fitBounds(bounds, { paddingTopLeft: [24, topPad], paddingBottomRight: [24, bottomPad] })
    }
    map.setMaxBounds(bounds.pad(0.2))

    return () => {
      active = false
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      if (overlayRef.current) {
        overlayRef.current.remove()
        overlayRef.current = null
      }
      placeholder.remove()
    }
  }, [layer])

  // 只有实例与当前图层一致时才向子图层提供地图，避免子图层向已销毁或待切换的实例绘制
  const activeMap = instance !== null && instance.layerId === layer.id ? instance.map : null

  useEffect(() => {
    if (!activeMap) return
    let group = markerGroupRef.current
    if (!group) {
      group = L.layerGroup().addTo(activeMap)
      markerGroupRef.current = group
    }
    group.clearLayers()
    markers.forEach((m) => {
      L.circleMarker(normToLatLng(m.x, m.y, layer), { color: m.color }).bindTooltip(m.label).addTo(group)
    })
  }, [markers, activeMap, layer])

  const contextValue = useMemo<CampusMapContextValue>(
    () => ({
      map: activeMap,
      layer,
      toMap: (nx, ny) => normToLatLng(nx, ny, layer),
      toNorm: (latlng) => latLngToNorm(latlng, layer),
    }),
    [activeMap, layer],
  )

  return (
    <CampusMapContext.Provider value={contextValue}>
      <div ref={containerRef} className={styles.map} />
      {/* 图层切换时整体重挂载子图层，避免旧图层的实例与清理函数跨图层残留 */}
      <Fragment key={layer.id}>{children}</Fragment>
    </CampusMapContext.Provider>
  )
}