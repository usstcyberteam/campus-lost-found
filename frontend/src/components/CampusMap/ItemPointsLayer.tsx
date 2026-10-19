import { useEffect, useRef, useState } from 'react'
import L, { type LatLng } from 'leaflet'
import { useNavigate } from 'react-router-dom'
import { directionLabels, type Building, type Direction, type Item } from '../../types'
import { clusterPoints, type ClusterInput } from '../../utils/cluster'
import { buildingCenter } from './BuildingLayer'
import { useCampusMap } from './MapContext'
import styles from './ItemPointsLayer.module.css'

const CLUSTER_RADIUS = 44

interface ItemPointsLayerProps {
  buildings: Building[]
  items: Item[]
  interactive?: boolean
}

function pinIcon(direction: Direction): L.DivIcon {
  const label = direction === 'lost' ? '寻' : '拾'
  const variant = direction === 'lost' ? styles.lost : styles.found
  return L.divIcon({
    className: styles.pinWrap,
    html: `<span class="${styles.pin} ${variant}">${label}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}

function clusterIcon(count: number): L.DivIcon {
  return L.divIcon({
    className: styles.pinWrap,
    html: `<span class="${styles.cluster}">${count}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}

export default function ItemPointsLayer({ buildings, items, interactive = true }: ItemPointsLayerProps) {
  const { map, layer, toMap } = useCampusMap()
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const [zoom, setZoom] = useState(0)

  useEffect(() => {
    if (!map) return
    const sync = () => setZoom(map.getZoom())
    sync()
    map.on('zoomend', sync)
    return () => {
      map.off('zoomend', sync)
    }
  }, [map])

  useEffect(() => {
    if (!map) return
    const currentZoom = map.getZoom()
    const buildingMap = new Map(buildings.map((building) => [building.id, building]))
    const entries: ClusterInput<Item>[] = []
    items.forEach((item) => {
      const building = item.building_id ? buildingMap.get(item.building_id) : undefined
      const center = building ? buildingCenter(building) : null
      if (!center) return
      const projected = map.project(toMap(center.x, center.y), currentZoom)
      entries.push({ x: projected.x, y: projected.y, data: item })
    })

    const group = L.layerGroup().addTo(map)
    const openItemList = (center: LatLng, clustered: Item[]) => {
      const container = document.createElement('div')
      container.className = styles.popup
      clustered.forEach((item) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = styles.popupItem
        button.textContent = `${directionLabels[item.direction]} · ${item.title}`
        button.addEventListener('click', () => navigateRef.current(`/hall/${item.id}`))
        container.append(button)
      })
      L.popup({ closeButton: true, minWidth: 200 }).setLatLng(center).setContent(container).openOn(map)
    }

    clusterPoints(entries, CLUSTER_RADIUS).forEach((cluster) => {
      const center = map.unproject(L.point(cluster.x, cluster.y), currentZoom)
      if (cluster.items.length === 1) {
        const item = cluster.items[0]
        L.marker(center, { icon: pinIcon(item.direction), keyboard: true, interactive })
          .bindTooltip(`${directionLabels[item.direction]} · ${item.title}`)
          .on('click', () => navigateRef.current(`/hall/${item.id}`))
          .addTo(group)
        return
      }
      L.marker(center, { icon: clusterIcon(cluster.items.length), keyboard: true, interactive })
        .bindTooltip(`${cluster.items.length} 条帖子，点击查看`)
        .on('click', () => openItemList(center, cluster.items))
        .addTo(group)
    })

    return () => {
      group.remove()
      map.closePopup()
    }
  }, [map, layer, buildings, items, toMap, zoom, interactive])

  return null
}