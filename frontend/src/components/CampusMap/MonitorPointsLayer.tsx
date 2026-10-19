import { useEffect } from 'react'
import L from 'leaflet'
import type { LayerPoint } from '../../types'
import { useCampusMap } from './MapContext'
import styles from './MonitorPointsLayer.module.css'

interface MonitorPointsLayerProps {
  points: LayerPoint[]
}

function monitorIcon(): L.DivIcon {
  return L.divIcon({
    className: styles.pinWrap,
    html: `<span class="${styles.pin}">监<span class="${styles.badge}">模拟</span></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}

export default function MonitorPointsLayer({ points }: MonitorPointsLayerProps) {
  const { map, layer, toMap } = useCampusMap()

  useEffect(() => {
    if (!map) return
    const group = L.layerGroup().addTo(map)
    points
      .filter((point) => point.kind === 'monitor_point')
      .forEach((point) => {
        const content = document.createElement('div')
        content.className = styles.popup
        const title = document.createElement('strong')
        title.textContent = `${point.label}（模拟）`
        content.append(title)
        const description = document.createElement('p')
        description.textContent = point.description ?? '模拟监控点位，不连接真实监控'
        content.append(description)
        L.marker(toMap(point.norm_x, point.norm_y), { icon: monitorIcon(), keyboard: true })
          .bindTooltip(`${point.label}（模拟监控点）`)
          .bindPopup(content)
          .addTo(group)
      })
    return () => {
      group.remove()
    }
  }, [map, layer, points, toMap])

  return null
}