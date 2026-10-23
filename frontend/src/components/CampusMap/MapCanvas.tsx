import type { Building, Item, Layer, LayerPoint, MapMeta, SearchAdvice } from '../../types'
import type { DrawToolState } from '../../hooks/useDrawTool'
import CampusMap, { type MapMarker } from './CampusMap'
import AIRecommendLayer from './AIRecommendLayer'
import BuildingLayer from './BuildingLayer'
import DrawToolLayer from './DrawToolLayer'
import HeatmapLayer from './HeatmapLayer'
import HelpPointsLayer from './HelpPointsLayer'
import IndoorLayers from './IndoorLayers'
import ItemPointsLayer from './ItemPointsLayer'
import MapErrorBoundary from './MapErrorBoundary'
import MonitorPointsLayer from './MonitorPointsLayer'
import ClickCoordsPopup from '../../pages/ClickCoordsPopup'
import type { MapViewMode } from './MapTopBar'
import styles from './MapCanvas.module.css'

const NO_MARKERS: MapMarker[] = []
const NO_BUILDINGS: Building[] = []

export interface MapLayerSwitches {
  buildings: boolean
  items: boolean
  help: boolean
  monitor: boolean
  advice: boolean
  heatmap: boolean
  labels: boolean
}

interface MapCanvasProps {
  view: MapViewMode
  layer: Layer
  buildings: Building[]
  items: Item[]
  mapMeta: MapMeta | null
  advice: SearchAdvice | null
  helpPoints: LayerPoint[]
  monitorPoints: LayerPoint[]
  canSeeMonitor: boolean
  selectedBuilding: Building | null
  focus: { x: number; y: number; token: number } | null
  show: MapLayerSwitches
  tool: DrawToolState
  canDraw: boolean
  onMapClick: (norm: { x: number; y: number }) => void
  onImageError: (message: string) => void
}

// 地图画布：单一 CampusMap 实例，按视图决定叠加哪些图层
export default function MapCanvas({
  view,
  layer,
  buildings,
  items,
  mapMeta,
  advice,
  helpPoints,
  monitorPoints,
  canSeeMonitor,
  selectedBuilding,
  focus,
  show,
  tool,
  canDraw,
  onMapClick,
  onImageError,
}: MapCanvasProps) {
  const outdoor = view === 'flat'
  const indoor = view === 'iso'
  const floor = view === 'floor'
  const drawing = tool.mode !== null

  return (
    <MapErrorBoundary>
      <CampusMap
        layer={layer}
        markers={NO_MARKERS}
        focus={focus}
        onMapClick={onMapClick}
        onImageError={onImageError}
      >
        {outdoor && show.buildings && (
          <BuildingLayer
            buildings={buildings}
            selectedId={selectedBuilding?.id ?? null}
            recommendedCodes={show.advice && advice ? advice.locations.map((item) => item.building_code) : []}
            showLabels={show.labels}
          />
        )}
        {indoor && (
          <IndoorLayers
            buildings={buildings}
            matrix={mapMeta?.flat_to_iso ?? null}
            selectedId={selectedBuilding?.id ?? null}
            recommendedCodes={advice ? advice.locations.map((item) => item.building_code) : []}
            showBuildings={show.buildings}
            showAdvice={show.advice}
            showLabels={show.labels}
          />
        )}
        {outdoor && show.items && (
          <ItemPointsLayer buildings={buildings} items={items} interactive={!drawing} />
        )}
        {outdoor && show.help && <HelpPointsLayer points={helpPoints} />}
        {outdoor && canSeeMonitor && show.monitor && <MonitorPointsLayer points={monitorPoints} />}
        {outdoor && show.heatmap && <HeatmapLayer buildings={buildings} items={items} />}
        {outdoor && show.advice && advice && (
          <AIRecommendLayer
            buildings={buildings}
            locations={advice.locations}
            source={advice.source}
            degraded={advice.degraded}
          />
        )}
        {floor && (layer.rooms?.length ?? 0) > 0 && (
          <BuildingLayer buildings={NO_BUILDINGS} selectedId={null} rooms={layer.rooms ?? undefined} />
        )}
        {canDraw && <DrawToolLayer tool={tool} />}
        {canDraw && !drawing && <ClickCoordsPopup />}
      </CampusMap>
      {indoor && !layer.image_path && (
        <div className={styles.placeholder} aria-live="polite">
          <span>2.5D 底图缺失，暂不可用</span>
        </div>
      )}
      {floor && !layer.image_path && (
        <div className={styles.placeholder} aria-live="polite">
          <span>楼层图整理中</span>
        </div>
      )}
    </MapErrorBoundary>
  )
}