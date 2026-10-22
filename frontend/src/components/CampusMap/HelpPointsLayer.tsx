import { useEffect } from 'react'
import L from 'leaflet'
import type { LayerPoint } from '../../types'
import { useCampusMap } from './MapContext'
import styles from './HelpPointsLayer.module.css'

interface HelpPointsLayerProps {
  points: LayerPoint[]
}

function helpIcon(): L.DivIcon {
  return L.divIcon({
    className: styles.pinWrap,
    html: `<span class="${styles.pin}">求</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}

export default function HelpPointsLayer({ points }: HelpPointsLayerProps) {
  const { map, layer, toMap } = useCampusMap()

  useEffect(() => {
    if (!map) return
    const group = L.layerGroup().addTo(map)
    points
      .filter((point) => point.kind === 'help_point')
      .forEach((point) => {
        const content = document.createElement('div')
        content.className = styles.popup
        const title = document.createElement('strong')
        title.textContent = point.label
        content.append(title)
        if (point.description) {
          const description = document.createElement('p')
          description.textContent = point.description
          content.append(description)
        }
        L.marker(toMap(point.norm_x, point.norm_y), { icon: helpIcon(), keyboard: true })
          .bindTooltip(`${point.label}（求助点）`)
          .bindPopup(content)
          .addTo(group)
      })
    return () => {
      group.remove()
    }
  }, [map, layer, points, toMap])

  return null
}