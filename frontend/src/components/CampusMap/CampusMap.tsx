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
  children?: ReactNode
}

interface MapInstance {
  map: LeafletMap
  layerId: string
}

export default function CampusMap({ layer, markers, onMapClick, onImageError, children }: CampusMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // 记录实例所属图层：切换视图时旧实例仍可能被引用，只有与当前图层匹配的实例才交给子图层
  const [instance, setInstance] = useState<MapInstance | null>(null)

  const markerGroupRef = useRef<L.LayerGroup | null>(null)
  const onClickRef = useRef(onMapClick)
  const onErrorRef = useRef(onImageError)

  onClickRef.current = onMapClick
  onErrorRef.current = onImageError

  useEffect(() => {
    if (!containerRef.current) return
    let active = true
    let objectUrl: string | null = null
    const controller = new AbortController()

    const map = L.map(containerRef.current, { crs: L.CRS.Simple, minZoom: -3, maxZoom: 3 })

    setInstance({ map, layerId: layer.id })

    const bounds = L.latLngBounds([0, 0], [layer.height, layer.width])
    // 先铺占位矩形，底图缺失或加载失败时地图仍可操作，不会白屏
    L.rectangle(bounds, { color: cssVar('--color-border-strong'), weight: 1, fillOpacity: 0.03 }).addTo(map)
    if (layer.image_path) {
      getLayerImage(layer.id, controller.signal)
        .then((blob) => {
          if (!active) return
          const url = URL.createObjectURL(blob)
          objectUrl = url
          L.imageOverlay(url, bounds).addTo(map)
        })
        .catch((e) => {
          if (active) onErrorRef.current?.(errorMessage(e, '底图加载失败'))
        })
    }

    map.fitBounds(bounds)
    map.setMaxBounds(bounds.pad(0.2))
    map.on('click', (e) => {
      onClickRef.current?.(latLngToNorm(e.latlng, layer))
    })

    return () => {
      active = false
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      map.remove()

      markerGroupRef.current = null
      setInstance(null)
    }
  }, [layer])

  useEffect(() => {
    if (!instance || instance.layerId !== layer.id) return
    let group = markerGroupRef.current
    if (!group) {
      group = L.layerGroup().addTo(instance.map)
      markerGroupRef.current = group
    }
    group.clearLayers()
    markers.forEach((m) => {
      L.circleMarker(normToLatLng(m.x, m.y, layer), { color: m.color }).bindTooltip(m.label).addTo(group)
    })
  }, [markers, instance, layer])

  // 只有实例与当前图层一致时才向子图层提供地图，避免子图层向已销毁的实例绘制
  const activeMap = instance !== null && instance.layerId === layer.id ? instance.map : null
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
      {/* 图层切换时整体重挂载子图层，避免旧图层的实例与清理函数跨地图残留 */}
      <Fragment key={layer.id}>{children}</Fragment>
    </CampusMapContext.Provider>
  )
}