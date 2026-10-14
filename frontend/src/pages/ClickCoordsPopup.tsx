import { useEffect } from 'react'
import L from 'leaflet'
import type { LeafletMouseEvent } from 'leaflet'
import { useCampusMap } from '../components/CampusMap/MapContext'

// 作为 CampusMap 子组件：监听点击弹归一化坐标，不渲染任何 DOM
export default function ClickCoordsPopup() {
  const { map, toNorm } = useCampusMap()

  useEffect(() => {
    if (!map) return
    const handler = (e: LeafletMouseEvent) => {
      const { x, y } = toNorm(e.latlng)
      L.popup()
        .setLatLng(e.latlng)
        .setContent(`归一化坐标 (${x.toFixed(3)}, ${y.toFixed(3)})`)
        .openOn(map)
    }
    map.on('click', handler)
    return () => {
      map.off('click', handler)
    }
  }, [map, toNorm])

  return null
}