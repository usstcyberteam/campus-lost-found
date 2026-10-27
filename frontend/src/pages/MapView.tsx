import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import client, { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { directionLabels, statusLabels, type Item, type MapItem, type MyRoute, type RouteKind } from '../types'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Tag from '../components/ui/Tag'
import StatusBadge from '../components/ui/StatusBadge'
import ErrorState from '../components/ui/ErrorState'
import EmptyState from '../components/ui/EmptyState'
import styles from './MapView.module.css'

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

type DrawMode = 'view' | 'anchor' | 'circle' | 'polyline'

interface NormPoint {
  x: number
  y: number
}

interface Interaction {
  mode: DrawMode
  targetItemId: string
  anchor: NormPoint | null
  circleCenter: NormPoint | null
  circleEdge: NormPoint | null
  polyline: NormPoint[]
}

const emptyInteraction: Interaction = {
  mode: 'view',
  targetItemId: '',
  anchor: null,
  circleCenter: null,
  circleEdge: null,
  polyline: [],
}

const modeLabels: Record<DrawMode, string> = {
  view: '查看',
  anchor: '标点',
  circle: '画范围',
  polyline: '画路线',
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}

export default function MapView() {
  const { role } = useAuth()
  const [searchParams] = useSearchParams()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const itemGroupRef = useRef<L.LayerGroup | null>(null)
  const pointGroupRef = useRef<L.LayerGroup | null>(null)
  const drawGroupRef = useRef<L.LayerGroup | null>(null)
  const routeGroupRef = useRef<L.LayerGroup | null>(null)

  const [layers, setLayers] = useState<LayerInfo[]>([])
  const [selected, setSelected] = useState('')
  const [points, setPoints] = useState<Point[]>([])
  const [items, setItems] = useState<MapItem[]>([])
  const [routes, setRoutes] = useState<MyRoute[]>([])
  const [calibrated, setCalibrated] = useState(false)
  const [error, setError] = useState('')

  const [interaction, setInteraction] = useState<Interaction>(emptyInteraction)
  const [myItems, setMyItems] = useState<Item[]>([])
  const [selectedItem, setSelectedItem] = useState<MapItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const modeRef = useRef<DrawMode>(interaction.mode)
  useEffect(() => {
    modeRef.current = interaction.mode
  }, [interaction.mode])

  useEffect(() => {
    let active = true
    client.get('/layers').then((r) => {
      if (!active) return
      setLayers(r.data)
      if (r.data.length > 0) setSelected(r.data[0].id)
    }).catch((e) => { if (active) setError(errorMessage(e)) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    client.get('/me/items').then((r) => { if (active) setMyItems(r.data) })
      .catch(() => { if (active) setMyItems([]) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    client.get('/me/routes').then((r) => { if (active) setRoutes(r.data) })
      .catch(() => { if (active) setRoutes([]) })
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
    setSelectedItem(null)

    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
      itemGroupRef.current = null
      pointGroupRef.current = null
      drawGroupRef.current = null
      routeGroupRef.current = null
    }

    const map = L.map(containerRef.current, { crs: L.CRS.Simple, minZoom: -3, maxZoom: 3 })
    mapRef.current = map
    setCalibrated(layer.scale_calibrated)

    const bounds = L.latLngBounds([0, 0], [layer.height, layer.width])
    if (!layer.image_path) {
      L.rectangle(bounds, { color: '#cbd5e1', weight: 1, fillOpacity: 0.03 }).addTo(map)
    } else {
      client.get(`/layers/${layer.id}/image`, { responseType: 'blob', signal: controller.signal })
        .then((res) => {
          if (!active) return
          const url = URL.createObjectURL(res.data)
          objectUrl = url
          L.imageOverlay(url, bounds).addTo(map)
        })
        .catch((e) => { if (active) setError(errorMessage(e, '底图加载失败')) })
    }

    map.fitBounds(bounds)
    map.setMaxBounds(bounds.pad(0.2))

    const focusLayer = searchParams.get('layer')
    const fx = searchParams.get('nx')
    const fy = searchParams.get('ny')
    if (focusLayer === layer.id && fx !== null && fy !== null) {
      const nx = Number(fx)
      const ny = Number(fy)
      if (Number.isFinite(nx) && Number.isFinite(ny)) {
        map.setView(L.latLng(ny * layer.height, nx * layer.width), 1)
      }
    }

    map.on('click', (e) => {
      const nx = e.latlng.lng / layer.width
      const ny = e.latlng.lat / layer.height
      if (modeRef.current === 'view') {
        L.popup().setLatLng(e.latlng).setContent(`归一化坐标 (${nx.toFixed(3)}, ${ny.toFixed(3)})`).openOn(map)
        return
      }
      const p: NormPoint = { x: nx, y: ny }
      setInteraction((prev) => {
        if (prev.mode === 'anchor') return { ...prev, anchor: p }
        if (prev.mode === 'circle') {
          if (!prev.circleCenter) return { ...prev, circleCenter: p }
          if (!prev.circleEdge) return { ...prev, circleEdge: p }
          return { ...prev, circleCenter: p, circleEdge: null }
        }
        if (prev.mode === 'polyline') return { ...prev, polyline: [...prev.polyline, p] }
        return prev
      })
    })

    return () => {
      active = false
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      map.remove()
      if (mapRef.current === map) {
        mapRef.current = null
        itemGroupRef.current = null
        pointGroupRef.current = null
        drawGroupRef.current = null
        routeGroupRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, layers])

  useEffect(() => {
    let active = true
    setItems([])
    if (!selected) return
    client.get(`/layers/${selected}/items`).then((r) => { if (active) setItems(r.data) })
      .catch((e) => { if (active) setError(errorMessage(e)) })
    return () => { active = false }
  }, [selected])

  useEffect(() => {
    let active = true
    setPoints([])
    if (!selected || (role !== 'staff' && role !== 'admin')) return
    client.get(`/layers/${selected}/simulated-points`).then((r) => { if (active) setPoints(r.data) })
      .catch((e) => { if (active) setError(errorMessage(e)) })
    return () => { active = false }
  }, [selected, role])

  useEffect(() => {
    if (!mapRef.current) return
    let group = itemGroupRef.current
    if (!group) {
      group = L.layerGroup().addTo(mapRef.current)
      itemGroupRef.current = group
    }
    group.clearLayers()
    const layer = layers.find((l) => l.id === selected)
    if (!layer) return
    items.forEach((item) => {
      if (item.norm_x == null || item.norm_y == null) return
      const color = item.direction === 'lost' ? '#315CF5' : '#16B8A6'
      const marker = L.circleMarker(L.latLng(item.norm_y * layer.height, item.norm_x * layer.width), {
        radius: 6, color, fillColor: color, fillOpacity: 0.9, weight: 2,
      })
      marker.bindTooltip(`${directionLabels[item.direction]} · ${esc(item.title)}`)
      marker.bindPopup(
        `<b>${esc(item.title)}</b><br/>${directionLabels[item.direction]} · ${esc(item.category)} · ${statusLabels[item.status]}${item.is_simulated ? '（模拟）' : ''}`
      )
      marker.on('click', () => setSelectedItem(item))
      marker.addTo(group)
    })
  }, [items, layers, selected])

  useEffect(() => {
    if (!mapRef.current) return
    let group = pointGroupRef.current
    if (!group) {
      group = L.layerGroup().addTo(mapRef.current)
      pointGroupRef.current = group
    }
    group.clearLayers()
    const layer = layers.find((l) => l.id === selected)
    if (!layer) return
    points.forEach((p) => {
      L.circleMarker(L.latLng(p.norm_y * layer.height, p.norm_x * layer.width), { color: '#FF8B5E' })
        .bindTooltip(`${esc(p.label)}（模拟点位）`)
        .addTo(group)
    })
  }, [points, layers, selected])

  useEffect(() => {
    if (!mapRef.current) return
    let group = drawGroupRef.current
    if (!group) {
      group = L.layerGroup().addTo(mapRef.current)
      drawGroupRef.current = group
    }
    group.clearLayers()
    const layer = layers.find((l) => l.id === selected)
    if (!layer || interaction.mode === 'view') return

    const toLatLng = (p: NormPoint) => L.latLng(p.y * layer.height, p.x * layer.width)

    if (interaction.mode === 'anchor' && interaction.anchor) {
      L.circleMarker(toLatLng(interaction.anchor), { radius: 8, color: '#7B61FF' }).addTo(group)
    }
    if (interaction.mode === 'circle') {
      if (interaction.circleCenter) {
        L.circleMarker(toLatLng(interaction.circleCenter), { radius: 6, color: '#7B61FF' }).addTo(group)
      }
      if (interaction.circleCenter && interaction.circleEdge) {
        const center = toLatLng(interaction.circleCenter)
        const edge = toLatLng(interaction.circleEdge)
        const dx = edge.lng - center.lng
        const dy = edge.lat - center.lat
        L.circle(center, { radius: Math.sqrt(dx * dx + dy * dy), color: '#7B61FF', weight: 2, fillOpacity: 0.1 }).addTo(group)
      }
    }
    if (interaction.mode === 'polyline' && interaction.polyline.length > 0) {
      L.polyline(interaction.polyline.map(toLatLng), { color: '#7B61FF', weight: 3 }).addTo(group)
      interaction.polyline.forEach((p) => {
        L.circleMarker(toLatLng(p), { radius: 4, color: '#7B61FF' }).addTo(group)
      })
    }
  }, [interaction, layers, selected])

  useEffect(() => {
    if (!mapRef.current) return
    let group = routeGroupRef.current
    if (!group) {
      group = L.layerGroup().addTo(mapRef.current)
      routeGroupRef.current = group
    }
    group.clearLayers()
    const layer = layers.find((l) => l.id === selected)
    if (!layer) return
    routes.forEach((r) => {
      if (r.layer_id !== selected) return
      if (r.kind === 'circle') {
        const g = r.geometry as { cx: number; cy: number; r: number } | null
        if (!g) return
        L.circle(L.latLng(g.cy * layer.height, g.cx * layer.width), {
          radius: g.r * layer.width, color: '#7B61FF', weight: 2, fillOpacity: 0.05, dashArray: '6 6',
        }).addTo(group)
      } else if (r.kind === 'polyline') {
        const g = r.geometry as { x: number; y: number }[] | null
        if (!g || !Array.isArray(g)) return
        L.polyline(g.map((p) => L.latLng(p.y * layer.height, p.x * layer.width)), {
          color: '#7B61FF', weight: 3, dashArray: '6 6',
        }).addTo(group)
      }
    })
  }, [routes, layers, selected])

  function changeMode(mode: DrawMode) {
    setInteraction({ ...emptyInteraction, mode, targetItemId: interaction.targetItemId })
    setMsg('')
  }

  function resetDraw() {
    setInteraction((prev) => ({ ...prev, anchor: null, circleCenter: null, circleEdge: null, polyline: [] }))
  }

  async function saveDraw() {
    if (busy) return
    setMsg('')
    if (!interaction.targetItemId) {
      setMsg('请先选择要标记/绘制的委托')
      return
    }
    const targetId = interaction.targetItemId
    setBusy(true)
    try {
      if (interaction.mode === 'anchor') {
        const p = interaction.anchor
        if (!p) {
          setMsg('请先在地图上点击标点')
          return
        }
        await client.post(`/items/${targetId}/map-anchor`, {
          layer_id: selected,
          norm_x: p.x,
          norm_y: p.y,
          is_simulated: false,
        })
        setMsg('标点已保存')
      } else if (interaction.mode === 'circle') {
        const c = interaction.circleCenter
        const e = interaction.circleEdge
        if (!c || !e) {
          setMsg('请先点击圆心，再点击半径边缘')
          return
        }
        await client.post(`/items/${targetId}/route`, {
          kind: 'circle' as RouteKind,
          layer_id: selected,
          geometry: { cx: c.x, cy: c.y, r: Math.hypot(e.x - c.x, e.y - c.y) },
          floor_segments: null,
        })
        setMsg('范围已保存')
      } else if (interaction.mode === 'polyline') {
        const pts = interaction.polyline
        if (pts.length < 2) {
          setMsg('请至少点击两个点绘制路线')
          return
        }
        await client.post(`/items/${targetId}/route`, {
          kind: 'polyline' as RouteKind,
          layer_id: selected,
          geometry: pts.map((p) => ({ x: p.x, y: p.y })),
          floor_segments: null,
        })
        setMsg('路线已保存')
      }
      setInteraction({ ...emptyInteraction, targetItemId: targetId })
      const [refresh, rr] = await Promise.all([
        client.get(`/layers/${selected}/items`),
        client.get('/me/routes'),
      ])
      setItems(refresh.data)
      setRoutes(rr.data)
    } catch (e) {
      setMsg(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>校园地图</h1>

      {error && <ErrorState message={error} />}

      {layers.length === 0 && !error && (
        <EmptyState title="暂无图层" description="请先初始化地图数据" />
      )}

      <div className={styles.controls}>
        <select
          className={styles.layerSelect}
          value={selected}
          onChange={(e) => { setSelected(e.target.value); setInteraction(emptyInteraction); setSelectedItem(null) }}
          aria-label="选择图层"
        >
          {layers.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}{l.scale_calibrated ? '（已标定）' : '（未标定）'}
            </option>
          ))}
        </select>

        <div className={styles.modeGroup}>
          {(Object.keys(modeLabels) as DrawMode[]).map((m) => (
            <button
              key={m}
              className={`${styles.modeBtn} ${interaction.mode === m ? styles.modeBtnActive : ''}`}
              onClick={() => changeMode(m)}
              disabled={interaction.mode === m}
            >
              {modeLabels[m]}
            </button>
          ))}
        </div>
      </div>

      {interaction.mode !== 'view' && (
        <Card variant="outlined" className={styles.drawPanel}>
          <label className={styles.targetLabel}>
            目标委托（我的发布）：
            <select
              className={styles.targetSelect}
              value={interaction.targetItemId}
              onChange={(e) => setInteraction((prev) => ({ ...prev, targetItemId: e.target.value, anchor: null, circleCenter: null, circleEdge: null, polyline: [] }))}
            >
              <option value="">请选择</option>
              {myItems.map((i) => (
                <option key={i.id} value={i.id}>[{directionLabels[i.direction]}] {i.title}</option>
              ))}
            </select>
          </label>
          <div className={styles.drawActions}>
            <Button variant="primary" size="sm" onClick={saveDraw} loading={busy}>保存</Button>
            <Button variant="ghost" size="sm" onClick={resetDraw} disabled={busy}>清空</Button>
          </div>
          <p className={styles.drawHint}>
            {interaction.mode === 'anchor' && '在地图上点击一次位置，再点「保存」。'}
            {interaction.mode === 'circle' && '先点圆心，再点半径边缘；再次点击可重画。'}
            {interaction.mode === 'polyline' && '依次点击途经点；「清空」撤销全部，点「保存」完成。'}
          </p>
          {msg && <p className={styles.drawMsg} role="status">{msg}</p>}
        </Card>
      )}

      {selectedItem && (
        <Card variant="elevated" className={styles.selectedInfo}>
          <div className={styles.selectedHeader}>
            <Tag variant={selectedItem.direction === 'lost' ? 'coral' : 'mint'}>
              {directionLabels[selectedItem.direction]}
            </Tag>
            <strong className={styles.selectedTitle}>{selectedItem.title}</strong>
          </div>
          <div className={styles.selectedMeta}>
            <span>{selectedItem.category}</span>
            <StatusBadge status={selectedItem.status} />
            {selectedItem.is_simulated && <Tag variant="secondary">模拟</Tag>}
          </div>
          <Link to={`/items/${selectedItem.id}`}>查看详情</Link>
        </Card>
      )}

      <div ref={containerRef} className={styles.mapContainer} />

      <div className={styles.legend}>
        <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.dotPrimary}`} />寻物</span>
        <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.dotMint}`} />拾获</span>
        <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.dotSecondary}`} />绘制预览</span>
        <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.dotCoral}`} />模拟点位</span>
        <span className={styles.legendItem}>
          {calibrated ? <Tag variant="mint">已标定比例尺</Tag> : <Tag variant="gray">未标定比例尺</Tag>}
        </span>
      </div>
    </main>
  )
}
