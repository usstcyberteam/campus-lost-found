import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import client, { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'

interface LayerInfo {
  id: string
  name: string
  version: string
  width: number
  height: number
  scale_calibrated: boolean
  image_path: string | null
}

interface Point {
  id: string
  label: string
  norm_x: number
  norm_y: number
  is_simulated: boolean
}

export default function MapView() {
  const { role } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerGroupRef = useRef<L.LayerGroup | null>(null)
  const [layers, setLayers] = useState<LayerInfo[]>([])
  const [selected, setSelected] = useState('')
  const [points, setPoints] = useState<Point[]>([])
  const [calibrated, setCalibrated] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    client.get('/layers').then((r) => {
      if (!active) return
      setLayers(r.data)
      if (r.data.length > 0) setSelected(r.data[0].id)
    }).catch(e => { if (active) setError(errorMessage(e)) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!containerRef.current || !selected) return
    const layer = layers.find((l) => l.id === selected)
    if (!layer) return
    let active = true
    let objectUrl: string | null = null
    const controller = new AbortController()
    setError('')

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
      L.rectangle(bounds, { color: '#cbd5e1', weight: 1, fillOpacity: 0.03 }).addTo(map)
    } else {
      client
        .get(`/layers/${layer.id}/image`, { responseType: 'blob', signal: controller.signal })
        .then((res) => {
          if (!active) return
          const url = URL.createObjectURL(res.data)
          objectUrl = url
          L.imageOverlay(url, bounds).addTo(map)
        })
        .catch(e => { if (active) setError(errorMessage(e, '底图加载失败')) })
    }

    map.fitBounds(bounds)
    map.setMaxBounds(bounds.pad(0.2))
    map.on('click', (e) => {
      const nx = e.latlng.lng / layer.width
      const ny = e.latlng.lat / layer.height
      L.popup().setLatLng(e.latlng).setContent(`归一化坐标 (${nx.toFixed(3)}, ${ny.toFixed(3)})`).openOn(map)
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
    let active = true
    setPoints([])
    if (!selected || (role !== 'staff' && role !== 'admin')) return
    client.get(`/layers/${selected}/simulated-points`).then((r) => { if (active) setPoints(r.data) })
      .catch(e => { if (active) setError(errorMessage(e)) })
    return () => { active = false }
  }, [selected, role])

  useEffect(() => {
    if (!mapRef.current) return
    if (!markerGroupRef.current) {
      markerGroupRef.current = L.layerGroup().addTo(mapRef.current)
    }
    markerGroupRef.current.clearLayers()
    const layer = layers.find((l) => l.id === selected)
    if (!layer) return
    points.forEach((p) => {
      L.circleMarker(L.latLng(p.norm_y * layer.height, p.norm_x * layer.width), { color: '#d97706' })
        .bindTooltip(`${p.label}（模拟点位）`)
        .addTo(markerGroupRef.current!)
    })
  }, [points, layers, selected])

  return (
    <div style={{ padding: 24 }}>
      <h1>地图</h1>
      {error && <p role="alert">{error}</p>}
      {layers.length === 0 && !error && <p>暂无图层，请先初始化地图数据。</p>}
      <select value={selected} onChange={(e) => setSelected(e.target.value)}>
        {layers.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
            {l.scale_calibrated ? '（已标定）' : '（未标定，不显示米数）'}
          </option>
        ))}
      </select>
      <div ref={containerRef} style={{ height: 560, marginTop: 12, border: '1px solid #cbd5e1', background: '#f8fafc' }} />
      <p style={{ color: '#6b7280' }}>
        点击地图获取归一化坐标；{calibrated ? '已标定比例尺' : '未标定比例尺，不换算实际米数'}。
      </p>
    </div>
  )
}
