import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { LeafletMouseEvent } from 'leaflet'
import type { DrawMode, DrawToolState } from '../../hooks/useDrawTool'
import { useCampusMap } from './MapContext'
import styles from './DrawToolLayer.module.css'

interface DrawToolLayerProps {
  tool: DrawToolState
}

const HINTS: Record<DrawMode, string> = {
  point: '点一下地图完成标点',
  circle: '点一下设置圆心，再拖动或点击确定半径',
  polyline: '依次点击添加拐点，点「完成」结束绘制',
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export default function DrawToolLayer({ tool }: DrawToolLayerProps) {
  const { map, layer, toMap, toNorm } = useCampusMap()
  const toolRef = useRef(tool)
  toolRef.current = tool
  const circlePlaced = tool.mode === 'circle' && tool.circle !== null

  useEffect(() => {
    if (!map || tool.mode === null) return
    const dragging = map.dragging
    if (circlePlaced) dragging.disable()
    const onClick = (event: LeafletMouseEvent) => toolRef.current.handleClick(toNorm(event.latlng))
    const onMove = (event: LeafletMouseEvent) => {
      const current = toolRef.current
      if (current.mode === 'circle' && current.circle !== null) current.updateCircle(toNorm(event.latlng))
    }
    const container = map.getContainer()
    const onTouchMove = (event: TouchEvent) => {
      const current = toolRef.current
      if (current.mode !== 'circle' || current.circle === null || event.touches.length !== 1) return
      const touch = event.touches[0] as unknown as MouseEvent
      current.updateCircle(toNorm(map.mouseEventToLatLng(touch)))
    }
    map.on('click', onClick)
    map.on('mousemove', onMove)
    container.addEventListener('touchmove', onTouchMove, { passive: true })
    return () => {
      map.off('click', onClick)
      map.off('mousemove', onMove)
      container.removeEventListener('touchmove', onTouchMove)
      if (circlePlaced) dragging.enable()
    }
  }, [map, layer, toNorm, tool.mode, circlePlaced])

  useEffect(() => {
    if (!map) return
    const group = L.layerGroup().addTo(map)
    if (tool.point) {
      L.circleMarker(toMap(tool.point.x, tool.point.y), {
        radius: 8,
        color: cssVar('--color-primary'),
        fillColor: cssVar('--color-primary'),
        fillOpacity: 1,
      }).addTo(group)
    }
    if (tool.points.length > 0) {
      L.polyline(
        tool.points.map((point) => toMap(point.x, point.y)),
        { color: cssVar('--color-primary'), weight: 3 },
      ).addTo(group)
    }
    if (tool.circle) {
      L.circle(toMap(tool.circle.center.x, tool.circle.center.y), {
        radius: tool.circle.radius * layer.width,
        color: cssVar('--color-warning'),
        fillColor: cssVar('--color-warning'),
        fillOpacity: 0.12,
      }).addTo(group)
    }
    return () => {
      group.remove()
    }
  }, [map, layer.width, toMap, tool.point, tool.circle, tool.points])

  return tool.mode === null ? null : (
    <div className={styles.hint} role="status">
      {HINTS[tool.mode]}
      {tool.mode === 'polyline' && tool.points.length > 0 && `（已添加 ${tool.points.length} 个点）`}
    </div>
  )
}