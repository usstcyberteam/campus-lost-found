import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { getMapMeta, listLayerPoints } from '../api/layers'
import { useAsync } from '../hooks/useAsync'
import { useCampusMapLayers } from '../hooks/useCampusMapLayers'
import { useDrawTool } from '../hooks/useDrawTool'
import { useLayers } from '../hooks/useLayers'
import { useSearchAdvice } from '../hooks/useSearchAdvice'
import { useAuth } from '../auth/AuthContext'
import type { Building, Direction, LayerPoints, SearchAdvice } from '../types'
import ErrorNotice from '../components/ErrorNotice'
import { buildingAt } from '../components/CampusMap/BuildingLayer'
import { flatBuildingAt, isoBuildingAt } from '../components/CampusMap/coords'
import FloorSwitcher from '../components/CampusMap/FloorSwitcher'
import MapBuildingCard from '../components/CampusMap/MapBuildingCard'
import MapCanvas, { type MapLayerSwitches } from '../components/CampusMap/MapCanvas'
import MapDrawer, { type MapDrawerTab } from '../components/CampusMap/MapDrawer'
import MapTopBar, { type MapFilterKey, type MapViewMode } from '../components/CampusMap/MapTopBar'
import { buildingPoint, selectMapBuildings } from '../components/CampusMap/mapResults'
import { readStoredSwitches, saveStoredSwitches } from '../components/CampusMap/mapViewStorage'
import styles from './MapView.module.css'

export default function MapView() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { role } = useAuth()
  const [initial] = useState(readStoredSwitches)
  const initialAdvice = (location.state as { advice?: SearchAdvice } | null)?.advice ?? null
  const { advice, error: adviceError, pending: advicePending, request } = useSearchAdvice(initialAdvice)

  const [view, setView] = useState<MapViewMode>('flat')
  const [floorLayerId, setFloorLayerId] = useState<string | null>(null)
  const [pendingLocate, setPendingLocate] = useState<Building | null>(null)
  const [imageError, setImageError] = useState('')
  const [show, setShow] = useState<MapLayerSwitches>({
    buildings: initial.showBuildings ?? true,
    items: initial.showItems ?? true,
    help: initial.showHelp ?? true,
    monitor: initial.showMonitor ?? false,
    advice: initial.showAdvice ?? true,
    heatmap: initial.showHeatmap ?? false,
    labels: initial.showLabels ?? false,
  })
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  const [cardClosed, setCardClosed] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<MapFilterKey>('all')
  const [drawerTab, setDrawerTab] = useState<MapDrawerTab>('results')
  const [focus, setFocus] = useState<{ x: number; y: number; token: number } | null>(null)
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
  const indoor = view === 'iso'
  const isFloor = view === 'floor'
  const canDraw = layer != null && !indoor && !(isFloor && !layer.image_path)

  const currentBuilding =
    isFloor && layer?.building_id != null
      ? (mapLayers?.buildings.find((building) => building.id === layer.building_id) ?? null)
      : null
  const cardBuilding = isFloor ? currentBuilding : selectedBuilding
  const floorLayers =
    cardBuilding && layers ? layers.filter((item) => item.kind === 'floor' && item.building_id === cardBuilding.id) : []
  const currentFloorLayers =
    isFloor && layer?.building_id != null && layers
      ? layers.filter((item) => item.kind === 'floor' && item.building_id === layer.building_id)
      : []

  useEffect(() => saveStoredSwitches(show), [show])

  // 从帖子详情"在地图上看"跳来（/map?building=…）：数据就绪后选中并定位该楼，参数用完即清
  const targetBuildingId = searchParams.get('building')
  useEffect(() => {
    if (!targetBuildingId || !mapLayers || layer?.id !== flatLayerId) return
    const target = mapLayers.buildings.find((building) => building.id === targetBuildingId)
    if (target) {
      setSelectedBuilding(target)
      setCardClosed(false)
      const point = buildingPoint(target)
      if (point) setFocus({ ...point, token: Date.now() })
    }
    setSearchParams({}, { replace: true })
  }, [targetBuildingId, mapLayers, layer, flatLayerId, setSearchParams])

  // 切换视图会重设视野，定位要等新图层挂载后再执行，否则会被 fitBounds 覆盖
  useEffect(() => {
    if (!pendingLocate || layer?.id !== flatLayerId) return
    const point = buildingPoint(pendingLocate)
    if (point) setFocus({ ...point, token: Date.now() })
    setPendingLocate(null)
  }, [pendingLocate, layer, flatLayerId])

  const helpPoints = useMemo(() => pointData?.points.filter((p) => p.kind === 'help_point') ?? [], [pointData])
  const monitorPoints = useMemo(() => pointData?.points.filter((p) => p.kind === 'monitor_point') ?? [], [pointData])
  const results = useMemo(
    () =>
      selectMapBuildings(
        mapLayers?.buildings ?? [],
        query,
        filter,
        tool.point ?? (selectedBuilding ? buildingPoint(selectedBuilding) : null),
      ),
    [mapLayers, query, filter, tool.point, selectedBuilding],
  )
  const nearUnavailable = filter === 'near' && !tool.point && !selectedBuilding

  function toggleLayer(key: keyof MapLayerSwitches, checked: boolean) {
    setShow((current) => ({ ...current, [key]: checked }))
  }

  function resetTransient() {
    tool.clear()
    setSelectedBuilding(null)
    setCardClosed(false)
    setFocus(null)
  }

  function switchView(next: 'flat' | 'iso') {
    if (next === 'iso' && !canUseIso) return
    resetTransient()
    setView(next)
    setFloorLayerId(null)
    if (next === 'iso') setDrawerTab((current) => (current === 'tools' ? 'results' : current))
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
    setPendingLocate(selectedBuilding)
    setCardClosed(false)
    setView('flat')
    setFloorLayerId(null)
  }

  function handleMapClick(point: { x: number; y: number }) {
    // 绘制中点击用于落点，不切换选中建筑
    if (tool.mode !== null || (!outdoor && !indoor)) {
      setSelectedBuilding(null)
      return
    }
    const buildings = mapLayers?.buildings ?? []
    setSelectedBuilding(indoor ? isoBuildingAt(point, buildings) : flatBuildingAt(point, buildings))
    setCardClosed(false)
  }

  function focusBuilding(building: Building) {
    setSelectedBuilding(building)
    setCardClosed(false)
    setDrawerTab('results')
    if (!outdoor) return
    const point = buildingPoint(building)
    if (point) setFocus({ ...point, token: Date.now() })
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

  // 点建筑直接发帖：地点精确到楼（选了楼层就到层），不伪造具体坐标
  function publishAtBuilding(building: Building, direction: Direction, floor: number | null) {
    navigate('/publish', {
      state: {
        direction,
        building_id: building.id,
        building_name: building.name,
        floor,
        location_area: `${building.name}${floor != null ? `${floor}F` : ''}`,
      },
    })
  }

  async function recommend() {
    if (await request({ geometry: tool.geometry() })) toggleLayer('advice', true)
  }

  const notice = imageError || adviceError || (mapMetaError ? '地图元数据加载失败，室内视图不可用' : '')

  return (
    <div className={styles.page}>
      <div className={styles.mapWrap}>
        {layer ? (
          <MapCanvas
            view={view}
            layer={layer}
            buildings={mapLayers?.buildings ?? []}
            items={mapLayers?.items ?? []}
            mapMeta={mapMeta}
            advice={advice}
            helpPoints={helpPoints}
            monitorPoints={monitorPoints}
            canSeeMonitor={canSeeMonitor}
            showCoords={role === 'admin'}
            selectedBuilding={selectedBuilding}
            focus={focus}
            show={show}
            tool={tool}
            canDraw={canDraw}
            onMapClick={handleMapClick}
            onImageError={setImageError}
          />
        ) : (
          <div className={styles.mapEmpty}>
            {(!layers || layers.length === 0) && !layersError ? '暂无图层，请先初始化地图数据。' : '正在加载地图…'}
          </div>
        )}

        <MapTopBar
          view={view}
          canUseIso={canUseIso}
          onSwitchView={switchView}
          query={query}
          onQueryChange={setQuery}
          filter={filter}
          onFilterChange={setFilter}
          notice={notice ? <ErrorNotice message={notice} /> : undefined}
        >
          {isFloor && currentBuilding && currentFloorLayers.length > 0 && (
            <FloorSwitcher
              buildingName={currentBuilding.name}
              floors={currentFloorLayers}
              currentId={layer?.id ?? ''}
              onSelect={openFloor}
              onExit={() => switchView('flat')}
            />
          )}
        </MapTopBar>

        {cardBuilding && !cardClosed && (
          <MapBuildingCard
            building={cardBuilding}
            mode={isFloor ? 'floor' : indoor ? 'iso' : 'flat'}
            floorLayers={floorLayers}
            filterFloor={isFloor ? (layer?.floor ?? null) : null}
            belowTopBar={isFloor}
            onClose={() => {
              setSelectedBuilding(null)
              setCardClosed(true)
            }}
            onEnterFloor={openFloor}
            onLocateOutdoor={indoor ? locateOutdoor : undefined}
            onPublish={(direction, floor) => publishAtBuilding(cardBuilding, direction, floor)}
          />
        )}
      </div>

      <MapDrawer
        view={view}
        tab={drawerTab}
        onTabChange={setDrawerTab}
        results={results}
        nearUnavailable={nearUnavailable}
        selectedId={selectedBuilding?.id ?? null}
        onSelectBuilding={focusBuilding}
        layersError={layersError}
        mapLayersError={mapLayersError}
        pointsError={pointsError}
        layerSwitches={show}
        onToggleLayer={toggleLayer}
        canSeeMonitor={canSeeMonitor}
        adviceReady={advice != null}
        layer={layer}
        canDraw={canDraw}
        tool={tool}
        advicePending={advicePending}
        onRecommend={recommend}
        onPublish={publish}
      />
    </div>
  )
}
