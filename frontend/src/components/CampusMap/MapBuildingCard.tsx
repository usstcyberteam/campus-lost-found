import type { Building, Direction, Layer } from '../../types'

import BuildingCard from './BuildingCard'
import styles from './MapBuildingCard.module.css'

export type BuildingCardMode = 'flat' | 'iso' | 'floor'

interface MapBuildingCardProps {
  building: Building
  mode: BuildingCardMode
  floorLayers: Layer[]
  filterFloor: number | null
  belowTopBar: boolean
  onClose: () => void
  onEnterFloor: (layerId: string) => void
  onLocateOutdoor?: () => void
  onPublish?: (direction: Direction, floor: number | null) => void
}

// 悬浮在地图上的建筑卡片：避开顶部搜索区与底部抽屉
export default function MapBuildingCard({
  building,
  mode,
  floorLayers,
  filterFloor,
  belowTopBar,
  onClose,
  onEnterFloor,
  onLocateOutdoor,
  onPublish,
}: MapBuildingCardProps) {
  return (
    <div className={`${styles.wrap} ${belowTopBar ? styles.belowTopBar : ''}`}>
      <BuildingCard
        key={building.id}
        building={building}
        mode={mode}
        floorLayers={floorLayers}
        filterFloor={filterFloor}
        onClose={onClose}
        onEnterFloor={onEnterFloor}
        onLocateOutdoor={onLocateOutdoor}
        onPublish={onPublish}
      />
    </div>
  )
}
