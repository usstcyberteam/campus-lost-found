import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getMapMeta, listLayerPoints } from '../api/layers'
import { useAsync } from '../hooks/useAsync'
import { useCampusMapLayers } from '../hooks/useCampusMapLayers'
import { useDrawTool } from '../hooks/useDrawTool'
import { useLayers } from '../hooks/useLayers'
import { useSearchAdvice } from '../hooks/useSearchAdvice'
import { useAuth } from '../auth/AuthContext'
import type { Building, LayerPoints, SearchAdvice, Visibility } from '../types'
import Button from '../components/Button'
import ErrorNotice from '../components/ErrorNotice'
import PageContainer from '../components/PageContainer'
import PageHeader from '../components/AppShell/PageHeader'
import CampusMap, { type MapMarker } from '../components/CampusMap/CampusMap'
import AIRecommendLayer from '../components/CampusMap/AIRecommendLayer'
import BuildingCard from '../components/CampusMap/BuildingCard'
import BuildingLayer, { buildingAt } from '../components/CampusMap/BuildingLayer'
import { flatBuildingAt, isoBuildingAt } from '../components/CampusMap/coords'
import DrawToolLayer from '../components/CampusMap/DrawToolLayer'
import FloorSwitcher from '../components/CampusMap/FloorSwitcher'
import HeatmapLayer from '../components/CampusMap/HeatmapLayer'
import HelpPointsLayer from '../components/CampusMap/HelpPointsLayer'
import IsoBuildingLayer from '../components/CampusMap/IsoBuildingLayer'
import ItemPointsLayer from '../components/CampusMap/ItemPointsLayer'
import LayerToggles from '../components/CampusMap/LayerToggles'
import MapErrorBoundary from '../components/CampusMap/MapErrorBoundary'
import MonitorPointsLayer from '../components/CampusMap/MonitorPointsLayer'
import ClickCoordsPopup from './ClickCoordsPopup'
import styles from './MapView.module.css'

type MapViewMode = 'flat' | 'iso' | 'floor'
type BuildingCardMode = 'flat' | 'iso' | 'floor'

const NO_MARKERS: MapMarker[] = []
const NO_BUILDINGS: Building[] = []
const MAP_STATE_KEY = 'campus-map-view'

interface StoredMapState {
  showBuildings?: boolean
  showItems?: boolean
  showHelp?: boolean
  showMonitor?: boolean
  showAdvice?: boolean
  showHeatmap?: boolean
  showLabels?: boolean
}

function readStoredMapState(): StoredMapState {
  try {
    return JSON.parse(sessionStorage.getItem(MAP_STATE_KEY) ?? '{}') as StoredMapState
  } catch {
    return {}
  }
}

export default function MapView() {
  const navigate = useNavigate()
  const location = useLocation()
  const { role } = useAuth()
  const [initial] = useState(readStoredMapState)
  const initialAdvice = (location.state as { advice?: SearchAdvice } | null)?.advice ?? null
  const { advice, error: adviceError, pending: advicePending, request } = useSearchAdvice(initialAdvice)
  const [view, setView] = useState<MapViewMode>('flat')
  const [floorLayerId, setFloorLayerId] = useState<string | null>(null)

  const [imageError, setImageError] = useState('')
  const [showBuildings, setShowBuildings] = useState(initial.showBuildings ?? true)
  const [showItems, setShowItems] = useState(initial.showItems ?? true)
  const [showHelp, setShowHelp] = useState(initial.showHelp ?? true)
  const [showMonitor, setShowMonitor] = useState(initial.showMonitor ?? false)
  const [showAdvice, setShowAdvice] = useState(initial.showAdvice ?? true)
  const [showHeatmap, setShowHeatmap] = useState(initial.showHeatmap ?? false)
  const [showLabels, setShowLabels] = useState(initial.showLabels ?? false)
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  const [cardClosed, setCardClosed] = useState(false)
  const [focus, setFocus] = useState<{ buildingId: string; nonce: number } | null>(null)
  const tool = useDrawTool()

  const canSeeMonitor = role === 'staff' || role === 'admin'
  const { data: layers, error: layersError } = useLayers()
  const { data: mapLayers, error: mapLayersError } = useCampusMapLayers()
  const { data: mapMeta, error: mapMetaError } = useAsync(() => getMapMeta(), [])
  const flatLayerId = mapMeta?.flat_layer_id ?? layers?.find((item) => item.kind === 'flat')?.id ?? null
  const isoLayerId = mapMeta?.iso_layer_id ?? layers?.find((item) => item.kind === 'iso')?.id ?? null
  const canUseIso = mapMeta != null && isoLayerId != null
  const { data: pointData, error: pointsError } = useAsync(
    () => (flatLayerId ? listLayerPoints(flatLayerId) : Promise.resolve<LayerPoints | null>(null)),
    [flatLayerId],
  )

  const activeLayerId = view === 'flat' ? flatLayerId : view === 'iso' ? isoLayerId : floorLayerId
  const layer = layers?.find((item) => item.id === activeLayerId) ?? null

  const outdoor = view === 'flat'
  const isIso = view === 'iso'
  const isFloor = view === 'floor'
  const canDraw = layer != null && !isIso && !(isFloor && !layer.image_path)
  const drawing = tool.mode !== null
  const canUndo = tool.point !== null || tool.circle !== null || tool.points.length > 0

  const currentBuilding =
    isFloor && layer?.building_id != null
      ? (mapLayers?.buildings.find((building) => building.id === layer.building_id) ?? null)
      : null
  const cardBuilding = isFloor ? currentBuilding : selectedBuilding
  const floorLayers =
    cardBuilding && layers
      ? layers.filter((item) => item.kind === 'floor' && item.building_id === cardBuilding.id)
      : []
  const currentFloorLayers =
    isFloor && layer?.building_id != null && layers
      ? layers.filter((item) => item.kind === 'floor' && item.building_id === layer.building_id)
      : []
  const cardMode: BuildingCardMode = isFloor ? 'floor' : isIso ? 'iso' : 'flat'

  useEffect(() => {
    try {
      sessionStorage.setItem(
        MAP_STATE_KEY,
        JSON.stringify({ showBuildings, showItems, showHelp, showMonitor, showAdvice, showHeatmap, showLabels }),
      )
    } catch {
      /* 隐私模式下写入可能失败，不影响地图使用 */
    }
  }, [showBuildings, showItems, showHelp, showMonitor, showAdvice, showHeatmap, showLabels])

  const helpPoints = useMemo(() => pointData?.points.filter((p) => p.kind === 'help_point') ?? [], [pointData])
  const monitorPoints = useMemo(() => pointData?.points.filter((p) => p.kind === 'monitor_point') ?? [], [pointData])
  const recommendedCodes = useMemo(
    () => (showAdvice && advice ? advice.locations.map((location) => location.building_code) : []),
    [showAdvice, advice],
  )

  function resetTransient() {
    tool.clear()
    setSelectedBuilding(null)
    setCardClosed(false)
    setFocus(null)
  }

  function switchView(next: MapViewMode) {
    if (next === 'iso' && !canUseIso) return
    resetTransient()
    setView(next)
    if (next !== 'floor') setFloorLayerId(null)
  }

  function openFloor(targetId: string) {
    const target = layers?.find((item) => item.id === targetId)
    if (!target || target.kind !== 'floor') return
    resetTransient()
    setFloorLayerId(targetId)
    setView('floor')
  }

  function locateOutdoor() {
    if (!selectedBuilding || !flatLayerId) return
    tool.clear()
    setCardClosed(false)
    setView('flat')
    setFocus({ buildingId: selectedBuilding.id, nonce: Date.now() })
  }

  function handleMapClick(point: { x: number; y: number }) {
    if (drawing || (!outdoor && !isIso)) {
      setSelectedBuilding(null)
      return
    }
    const buildings = mapLayers?.buildings ?? []
    setSelectedBuilding(isIso ? isoBuildingAt(point, buildings) : flatBuildingAt(point, buildings))
    setCardClosed(false)
  }

  function publish() {
    const anchor = tool.point ?? tool.circle?.center ?? tool.points[0]
    if (!anchor || !layer) return
    const matched = outdoor
      ? buildingAt(anchor, mapLayers?.buildings ?? [])
      : (mapLayers?.buildings.find((building) => building.id === layer.building_id) ?? null)
    const floor = outdoor ? null : (layer.floor ?? null)
    navigate('/publish', {
      state: {
        building_id: matched?.id ?? null,
        building_name: matched?.name ?? null,
        floor,
        location_area: `${matched?.name ?? ''}${floor != null ? `${floor}F` : ''}`,
        layer_id: layer.id,
        norm_x: anchor.x,
        norm_y: anchor.y,
        geometry: tool.geometry(),
        route_kind: tool.routeKind,
        visibility: tool.visibility,
      },
    })
  }

  async function recommend() {
    if (await request({ geometry: tool.geometry() })) setShowAdvice(true)
  }

  return (
    <PageContainer>
      <PageHeader title="地图" />
      {layersError && <ErrorNotice message={layersError} />}
      {mapLayersError && <ErrorNotice message={mapLayersError} />}
      {pointsError && <ErrorNotice message={pointsError} />}
      {mapMetaError && <ErrorNotice message="地图元数据加载失败，室内视图不可用" />}
      {(imageError || adviceError) && <ErrorNotice message={imageError || adviceError} />}
      {(!layers || layers.length === 0) && !layersError && <p>暂无图层，请先初始化地图数据。</p>}
      <div className={styles.viewSwitch} role="group" aria-label="地图视图">
        <Button
          type="button"
          variant={view === 'flat' ? 'primary' : 'secondary'}
          aria-pressed={view === 'flat'}
          onClick={() => switchView('flat')}
        >
          室外
        </Button>
        <Button
          type="button"
          variant={view === 'iso' ? 'primary' : 'secondary'}
          aria-pressed={view === 'iso'}
          disabled={!canUseIso}
          onClick={() => switchView('iso')}
        >
          室内
        </Button>
      </div>
      {isFloor && currentBuilding && currentFloorLayers.length > 0 && (
        <FloorSwitcher
          buildingName={currentBuilding.name}
          floors={currentFloorLayers}
          currentId={layer?.id ?? ''}
          onSelect={openFloor}
          onExit={() => switchView('flat')}
        />
      )}
      <LayerToggles
        options={[
          {
            key: 'buildings',
            label: '建筑层',
            checked: showBuildings,
            disabled: !outdoor && !isIso,
            onChange: setShowBuildings,
          },
          { key: 'items', label: '帖子点位', checked: showItems, disabled: !outdoor, onChange: setShowItems },
          { key: 'help', label: '求助点位', checked: showHelp, disabled: !outdoor, onChange: setShowHelp },
          ...(canSeeMonitor
            ? [{ key: 'monitor', label: '监控点位（模拟）', checked: showMonitor, onChange: setShowMonitor }]
            : []),
          {
            key: 'advice',
            label: 'AI 推荐层',
            checked: showAdvice,
            disabled: (!outdoor && !isIso) || !advice,
            onChange: setShowAdvice,
          },
          { key: 'heatmap', label: '热力层', checked: showHeatmap, disabled: !outdoor, onChange: setShowHeatmap },
          {
            key: 'labels',
            label: '显示楼名',
            checked: showLabels,
            disabled: !outdoor && !isIso,
            onChange: setShowLabels,
          },
        ]}
      />
      {layer && canDraw && (
        <div className={styles.drawBar} role="toolbar" aria-label="地图绘制工具">
          <Button
            type="button"
            variant={tool.mode === 'point' ? 'primary' : 'secondary'}
            aria-pressed={tool.mode === 'point'}
            onClick={() => tool.start('point')}
          >
            标点
          </Button>
          <Button
            type="button"
            variant={tool.mode === 'circle' ? 'primary' : 'secondary'}
            aria-pressed={tool.mode === 'circle'}
            onClick={() => tool.start('circle')}
          >
            圈范围
          </Button>
          <Button
            type="button"
            variant={tool.mode === 'polyline' ? 'primary' : 'secondary'}
            aria-pressed={tool.mode === 'polyline'}
            onClick={() => tool.start('polyline')}
          >
            画路径
          </Button>
          <Button type="button" variant="secondary" onClick={tool.undo} disabled={!canUndo}>
            撤销上一步
          </Button>
          <Button type="button" variant="secondary" onClick={tool.finish} disabled={!drawing}>
            完成
          </Button>
          <Button type="button" variant="ghost" onClick={tool.clear} disabled={!canUndo && !drawing}>
            清空
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={recommend}
            disabled={!outdoor || !tool.hasResult}
            loading={advicePending}
          >
            AI 推荐地点
          </Button>
        </div>
      )}
      {canDraw && tool.hasResult && tool.routeKind && (
        <div className={styles.visibility}>
          <label className={styles.visibilityLabel}>
            路线可见性
            <select
              value={tool.visibility}
              onChange={(e) => tool.setVisibility(e.target.value as Visibility)}
            >
              <option value="private">私密（仅自己与已授权处理人员）</option>
              <option value="public">公开</option>
            </select>
          </label>
          <span className={styles.note}>圈选默认公开，路径默认私密</span>
        </div>
      )}
      {view === 'iso' && !layer && !mapMetaError && <p>2.5D 选楼图未就绪，暂不可用。</p>}
      {layer && (
        <div className={styles.mapArea}>
          <MapErrorBoundary>
            <CampusMap layer={layer} markers={NO_MARKERS} onMapClick={handleMapClick} onImageError={setImageError}>
              {outdoor && showBuildings && mapLayers && (
                <BuildingLayer
                  buildings={mapLayers.buildings}
                  selectedId={selectedBuilding?.id ?? null}
                  recommendedCodes={recommendedCodes}
                  showLabels={showLabels}
                  focus={focus}
                />
              )}
              {isIso && showBuildings && mapLayers && (
                <IsoBuildingLayer
                  buildings={mapLayers.buildings}
                  matrix={mapMeta?.flat_to_iso ?? null}
                  selectedId={selectedBuilding?.id ?? null}
                  recommendedCodes={recommendedCodes}
                  showLabels={showLabels}
                  monitorPoints={monitorPoints}
                  canSeeMonitor={canSeeMonitor && showMonitor}
                />
              )}
              {outdoor && showItems && mapLayers && (
                <ItemPointsLayer buildings={mapLayers.buildings} items={mapLayers.items} interactive={!drawing} />
              )}
              {outdoor && showHelp && <HelpPointsLayer points={helpPoints} />}
              {outdoor && canSeeMonitor && showMonitor && <MonitorPointsLayer points={monitorPoints} />}
              {outdoor && showHeatmap && mapLayers && (
                <HeatmapLayer buildings={mapLayers.buildings} items={mapLayers.items} />
              )}
              {outdoor && showAdvice && advice && mapLayers && (
                <AIRecommendLayer
                  buildings={mapLayers.buildings}
                  locations={advice.locations}
                  source={advice.source}
                  degraded={advice.degraded}
                />
              )}
              {isFloor && (layer.rooms?.length ?? 0) > 0 && (
                <BuildingLayer buildings={NO_BUILDINGS} selectedId={null} rooms={layer.rooms ?? undefined} />
              )}
              {canDraw && <DrawToolLayer tool={tool} />}
              {canDraw && !drawing && <ClickCoordsPopup />}
            </CampusMap>
          </MapErrorBoundary>
          {isIso && !layer.image_path && (
            <div className={styles.floorPlaceholder} aria-live="polite">
              <span>2.5D 底图缺失，暂不可用</span>
            </div>
          )}
          {isFloor && !layer.image_path && (
            <div className={styles.floorPlaceholder} aria-live="polite">
              <span>楼层图整理中</span>
            </div>
          )}
          {cardBuilding && !cardClosed && (
            <BuildingCard
              key={cardBuilding.id}
              building={cardBuilding}
              mode={cardMode}
              floorLayers={floorLayers}
              filterFloor={isFloor ? (layer.floor ?? null) : null}
              onClose={() => {
                setSelectedBuilding(null)
                setCardClosed(true)
              }}
              onEnterFloor={openFloor}
              onLocateOutdoor={isIso ? locateOutdoor : undefined}
            />
          )}
        </div>
      )}
      {layer && canDraw && tool.hasResult && (
        <div className={styles.publish}>
          <Button type="button" onClick={publish}>
            发布到大厅
          </Button>
        </div>
      )}
      <p className={styles.hint}>
        室外视图支持标点、圈范围、画路径；室内 2.5D 视图仅用于选楼，不写入位置；监控点为模拟数据，仅工作人员可见；
        {layer?.scale_calibrated ? '已标定比例尺' : '未标定比例尺，不换算实际米数'}。
      </p>
    </PageContainer>
  )
}
