import { useEffect } from 'react'
import L from 'leaflet'
import type { Building, SearchAdviceLocation, Source } from '../../types'
import { buildingCenter } from './BuildingLayer'
import { useCampusMap } from './MapContext'
import styles from './AIRecommendLayer.module.css'

interface AIRecommendLayerProps {
  buildings: Building[]
  locations: SearchAdviceLocation[]
  source: Source
  degraded: boolean
}

function orderIcon(order: number): L.DivIcon {
  return L.divIcon({
    className: styles.pinWrap,
    html: `<span class="${styles.pin}">${order}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })
}

function sourceLabel(source: Source, degraded: boolean): string {
  return source === 'model' && !degraded ? '实时模型' : '规则推荐'
}

export default function AIRecommendLayer({ buildings, locations, source, degraded }: AIRecommendLayerProps) {
  const { map, layer, toMap } = useCampusMap()

  useEffect(() => {
    if (!map) return
    const byCode = new Map(buildings.map((building) => [building.code, building]))
    const group = L.layerGroup().addTo(map)
    locations.forEach((location) => {
      const building = byCode.get(location.building_code)
      const center = building ? buildingCenter(building) : null
      if (!center) return
      const content = document.createElement('div')
      content.className = styles.popup
      const title = document.createElement('strong')
      title.textContent = `建议第 ${location.order} 前往：${location.building_name}`
      const reason = document.createElement('p')
      reason.textContent = location.reason
      const meta = document.createElement('span')
      meta.className = styles.meta
      meta.textContent = `AI 生成，仅供参考 · 来源：${sourceLabel(source, degraded)}`
      content.append(title, reason, meta)
      L.marker(toMap(center.x, center.y), { icon: orderIcon(location.order), keyboard: true })
        .bindTooltip(`推荐 ${location.order}：${location.building_name}`)
        .bindPopup(content)
        .addTo(group)
    })
    return () => {
      group.remove()
    }
  }, [map, layer, buildings, locations, source, degraded, toMap])

  return null
}