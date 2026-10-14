import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { errorMessage } from '../api/client'
import { getLayerImage, listLayers, listSimulatedPoints } from '../api/layers'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../auth/AuthContext'
import type { SimulatedPoint } from '../types'
import ErrorNotice from '../components/ErrorNotice'
import PageContainer from '../components/PageContainer'
import styles from './MapView.module.css'

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export default function MapView() {
  const { role } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerGroupRef = useRef<L.LayerGroup | null>(null)
  const [selected, setSelected] = useState('')
  const [calibrated, setCalibrated] = useState(false)
  const [imageError, setImageError] = useState('')

  const { data: layers, error: layersError } = useAsync(() => listLayers(), [])
  const { data: points, error: pointsError } = useAsync(
    () =>
      selected && (role === 'staff' || role === 'admin')
        ? listSimulatedPoints(selected)
        : Promise.resolve<SimulatedPoint[]>([]),
    [selected, role],
  )

  useEffect(() => {
    if (layers && layers.length > 0) setSelected(layers[0].id)
  }, [layers])

  useEffect(() => {
    if (!containerRef.current || !selected) return
    const layer = layers?.find((l) => l.id === selected)
    if (!layer) return
    let active = true
    let objectUrl: string | null = null
    const controller = new AbortController()
    setImageError('')

    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
      markerGroupRef.current = null
    }

    const map = L.map(containerRef.current, { crs: L.CRS.Simple, minZoom: -3, maxZoom: 3 })
    mapRef.current = map
    setCalibrated(layer.scale_calibrated)

    const bounds = L.latLngBounds([0, 0], [layer.height, layer.width])
    if (!layer.image_path) {
      L.rectangle(bounds, { color: cssVar('--color-border-strong'), weight: 1, fillOpacity: 0.03 }).addTo(map)
    } else {
      getLayerImage(layer.id, controller.signal)
        .then((blob) => {
          if (!active) return
          const url = URL.createObjectURL(blob)
          objectUrl = url
          L.imageOverlay(url, bounds).addTo(map)
        })
        .catch((e) => {
          if (active) setImageError(errorMessage(e, '底图加载失败'))
        })
    }

    map.fitBounds(bounds)
    map.setMaxBounds(bounds.pad(0.2))
    map.on('click', (e) => {
      const nx = e.latlng.lng / layer.width
      const ny = e.latlng.lat / layer.height
      L.popup()
        .setLatLng(e.latlng)
        .setContent(`归一化坐标 (${nx.toFixed(3)}, ${ny.toFixed(3)})`)
        .openOn(map)
    })
    return () => {
      active = false
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      map.remove()
      if (mapRef.current === map) {
        mapRef.current = null
        markerGroupRef.current = null
      }
    }
  }, [selected, layers])

  useEffect(() => {
    if (!mapRef.current) return
    if (!markerGroupRef.current) {
      markerGroupRef.current = L.layerGroup().addTo(mapRef.current)
    }
    markerGroupRef.current.clearLayers()
    const layer = layers?.find((l) => l.id === selected)
    if (!layer) return
    const markerColor = cssVar('--color-warning')
    ;(points ?? []).forEach((p) => {
      L.circleMarker(L.latLng(p.norm_y * layer.height, p.norm_x * layer.width), { color: markerColor })
        .bindTooltip(`${p.label}（模拟点位）`)
        .addTo(markerGroupRef.current!)
    })
  }, [points, layers, selected])

  return (
    <PageContainer>
      <h1>地图</h1>
      {layersError && <ErrorNotice message={layersError} />}
      {pointsError && <ErrorNotice message={pointsError} />}
      {imageError && <ErrorNotice message={imageError} />}
      {(!layers || layers.length === 0) && !layersError && <p>暂无图层，请先初始化地图数据。</p>}
      <select value={selected} onChange={(e) => setSelected(e.target.value)}>
        {layers?.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
            {l.scale_calibrated ? '（已标定）' : '（未标定，不显示米数）'}
          </option>
        ))}
      </select>
      <div ref={containerRef} className={styles.map} />
      <p className={styles.hint}>
        点击地图获取归一化坐标；{calibrated ? '已标定比例尺' : '未标定比例尺，不换算实际米数'}。
      </p>
    </PageContainer>
  )
}
