import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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

export default function CampusMap({ layer, markers, onMapClick, onImageError, focus, children }: CampusMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // map 用 useState 供 Context 订阅；mapRef 供 markers 副作用读取最新实例，避免闭包拿到已销毁旧实例
  const [map, setMap] = useState<LeafletMap | null>(null)
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
    const instance = mapRef.current
    if (!instance || !focus) return
    instance.panTo(normToLatLng(focus.x, focus.y, layerRef.current))
  }, [focus, map])

  // 地图实例只在挂载时创建、卸载时销毁：切换图层不重建实例。
  // 否则切换瞬间子图层 effect 会拿到即将被销毁的旧实例并向其添加图层，Leaflet 抛错导致整页白屏。
  useEffect(() => {
    if (!containerRef.current) return
    const instance = L.map(containerRef.current, { crs: L.CRS.Simple, minZoom: -3, maxZoom: 3 })
    mapRef.current = instance
    setMap(instance)

    instance.on('click', (e) => {
      onClickRef.current?.(latLngToNorm(e.latlng, layerRef.current))
    })

    return () => {
      mapRef.current = null
      markerGroupRef.current = null
      overlayRef.current = null
      instance.remove()
      setMap(null)
    }
  }, [])

  // 图层切换只更新底图与视野，不销毁地图实例
  useEffect(() => {
    const instance = mapRef.current
    if (!instance) return
    let active = true
    let objectUrl: string | null = null
    const controller = new AbortController()

    const bounds = L.latLngBounds([0, 0], [layer.height, layer.width])
    // 先铺占位矩形，底图缺失或加载失败时地图仍可操作，不会白屏
    const placeholder = L.rectangle(bounds, {
      color: cssVar('--color-border-strong'),
      weight: 1,
      fillOpacity: 0.03,
    }).addTo(instance)

    if (layer.image_path) {
      getLayerImage(layer.id, controller.signal)
        .then((blob) => {
          if (!active || mapRef.current !== instance) return
          const url = URL.createObjectURL(blob)
          objectUrl = url
          overlayRef.current = L.imageOverlay(url, bounds).addTo(instance)
        })
        .catch((e) => {
          if (active) onErrorRef.current?.(errorMessage(e, '底图加载失败'))
        })
    }

    instance.fitBounds(bounds)
    instance.setMaxBounds(bounds.pad(0.2))

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

  useEffect(() => {
    const instance = mapRef.current
    if (!instance) return
    let group = markerGroupRef.current
    if (!group) {
      group = L.layerGroup().addTo(instance)
      markerGroupRef.current = group
    }
    group.clearLayers()
    markers.forEach((m) => {
      L.circleMarker(normToLatLng(m.x, m.y, layer), { color: m.color }).bindTooltip(m.label).addTo(group)
    })
  }, [markers, map, layer])

  const value = useMemo<CampusMapContextValue>(
    () => ({
      map,
      layer,
      toMap: (nx, ny) => normToLatLng(nx, ny, layer),
      toNorm: (latlng) => latLngToNorm(latlng, layer),
    }),
    [map, layer],
  )

  return (
    <CampusMapContext.Provider value={value}>
      <div ref={containerRef} className={styles.map} />
      {children}
    </CampusMapContext.Provider>
  )
}