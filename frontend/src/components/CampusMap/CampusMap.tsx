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
  children?: ReactNode
}

export default function CampusMap({ layer, markers, onMapClick, onImageError, children }: CampusMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // map 用 useState 供 Context 订阅；mapRef 供 markers 副作用读取最新实例，避免闭包拿到已销毁旧实例
  const [map, setMap] = useState<LeafletMap | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
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

    const instance = L.map(containerRef.current, { crs: L.CRS.Simple, minZoom: -3, maxZoom: 3 })
    mapRef.current = instance
    setMap(instance)

    const bounds = L.latLngBounds([0, 0], [layer.height, layer.width])
    // 先铺占位矩形，底图缺失或加载失败时地图仍可操作，不会白屏
    L.rectangle(bounds, { color: cssVar('--color-border-strong'), weight: 1, fillOpacity: 0.03 }).addTo(instance)
    if (layer.image_path) {
      getLayerImage(layer.id, controller.signal)
        .then((blob) => {
          if (!active) return
          const url = URL.createObjectURL(blob)
          objectUrl = url
          L.imageOverlay(url, bounds).addTo(instance)
        })
        .catch((e) => {
          if (active) onErrorRef.current?.(errorMessage(e, '底图加载失败'))
        })
    }

    instance.fitBounds(bounds)
    instance.setMaxBounds(bounds.pad(0.2))
    instance.on('click', (e) => {
      onClickRef.current?.(latLngToNorm(e.latlng, layer))
    })

    return () => {
      active = false
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      instance.remove()
      mapRef.current = null
      markerGroupRef.current = null
      setMap(null)
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