import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { listLayerPoints } from '../api/layers'
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
import DrawToolLayer from '../components/CampusMap/DrawToolLayer'
import FloorSwitcher from '../components/CampusMap/FloorSwitcher'
import HeatmapLayer from '../components/CampusMap/HeatmapLayer'
import HelpPointsLayer from '../components/CampusMap/HelpPointsLayer'
import ItemPointsLayer from '../components/CampusMap/ItemPointsLayer'
import LayerToggles from '../components/CampusMap/LayerToggles'
import MonitorPointsLayer from '../components/CampusMap/MonitorPointsLayer'
import ClickCoordsPopup from './ClickCoordsPopup'
import styles from './MapView.module.css'

const NO_MARKERS: MapMarker[] = []
const MAP_STATE_KEY = 'campus-map-view'

interface StoredMapState {
  selected?: string
  showBuildings?: boolean
  showItems?: boolean
  showHelp?: boolean
  showMonitor?: boolean
  showAdvice?: boolean
  showHeatmap?: boolean
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
  const [selected, setSelected] = useState(initial.selected ?? '')

  const [imageError, setImageError] = useState('')
  const [showBuildings, setShowBuildings] = useState(initial.showBuildings ?? true)
  const [showItems, setShowItems] = useState(initial.showItems ?? true)
  const [showHelp, setShowHelp] = useState(initial.showHelp ?? true)
  const [showMonitor, setShowMonitor] = useState(initial.showMonitor ?? false)
  const [showAdvice, setShowAdvice] = useState(initial.showAdvice ?? true)
  const [showHeatmap, setShowHeatmap] = useState(initial.showHeatmap ?? false)
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  const tool = useDrawTool()

  const canSeeMonitor = role === 'staff' || role === 'admin'
  const { data: layers, error: layersError } = useLayers()
  const { data: mapLayers, error: mapLayersError } = useCampusMapLayers()
  const { data: pointData, error: pointsError } = useAsync(
    () => (selected ? listLayerPoints(selected) : Promise.resolve<LayerPoints | null>(null)),
    [selected],
  )

  useEffect(() => {
    if (layers && layers.length > 0) {
      setSelected((current) => {
        if (current && layers.some((item) => item.id === current)) return current
        return (layers.find((item) => item.building_id === null) ?? layers[0]).id
      })
    }
  }, [layers])

  const layer = layers?.find((l) => l.id === selected)
  const outdoor = layer != null && layer.building_id === null
  const floorLayers =
    selectedBuilding && layers ? layers.filter((item) => item.building_id === selectedBuilding.id) : []
  const currentBuilding =
    layer?.building_id != null
      ? (mapLayers?.buildings.find((building) => building.id === layer.building_id) ?? null)
      : null
  const currentFloorLayers =
    layer?.building_id != null && layers ? layers.filter((item) => item.building_id === layer.building_id) : []
  const outdoorLayerId = layers?.find((item) => item.building_id === null)?.id ?? null
  const drawing = tool.mode !== null
  const canUndo = tool.point !== null || tool.circle !== null || tool.points.length > 0

  useEffect(() => {
    try {
      sessionStorage.setItem(
        MAP_STATE_KEY,
        JSON.stringify({ selected, showBuildings, showItems, showHelp, showMonitor, showAdvice, showHeatmap }),
      )
    } catch {
      /* 隐私模式下写入可能失败，不影响地图使用 */
    }
  }, [selected, showBuildings, showItems, showHelp, showMonitor, showAdvice, showHeatmap])

  const helpPoints = useMemo(() => pointData?.points.filter((p) => p.kind === 'help_point') ?? [], [pointData])
  const monitorPoints = useMemo(() => pointData?.points.filter((p) => p.kind === 'monitor_point') ?? [], [pointData])

  function selectLayer(layerId: string) {
    tool.clear()
    setSelected(layerId)
    setSelectedBuilding(null)
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
        layer_id: selected,
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
      {(imageError || adviceError) && <ErrorNotice message={imageError || adviceError} />}
      {(!layers || layers.length === 0) && !layersError && <p>暂无图层，请先初始化地图数据。</p>}
      <select value={selected} onChange={(e) => selectLayer(e.target.value)} aria-label="选择图层">
        {layers?.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
            {l.scale_calibrated ? '（已标定）' : '（未标定，不显示米数）'}
          </option>
        ))}
      </select>
      {currentBuilding && currentFloorLayers.length > 0 && (
        <FloorSwitcher buildingName={currentBuilding.name} floors={currentFloorLayers}
          currentId={selected} outdoorId={outdoorLayerId} onSelect={selectLayer} />
      )}
      <LayerToggles
        options={[
          { key: 'buildings', label: '建筑层', checked: showBuildings, disabled: !outdoor, onChange: setShowBuildings },
          { key: 'items', label: '帖子点位', checked: showItems, disabled: !outdoor, onChange: setShowItems },
          { key: 'help', label: '求助点位', checked: showHelp, onChange: setShowHelp },
          ...(canSeeMonitor
            ? [{ key: 'monitor', label: '监控点位（模拟）', checked: showMonitor, onChange: setShowMonitor }]
            : []),
          { key: 'advice', label: 'AI 推荐层', checked: showAdvice, disabled: !outdoor || !advice, onChange: setShowAdvice },
          { key: 'heatmap', label: '热力层', checked: showHeatmap, disabled: !outdoor, onChange: setShowHeatmap },
        ]}
      />
      {layer && (
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
      {tool.hasResult && tool.routeKind && (
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
      {layer && (
        <div className={styles.mapArea}>
          <CampusMap
            layer={layer}
            markers={NO_MARKERS}
            onMapClick={() => setSelectedBuilding(null)}
            onImageError={setImageError}
          >
            {outdoor && showBuildings && mapLayers && (
              <BuildingLayer
                buildings={mapLayers.buildings}
                selectedId={selectedBuilding?.id ?? null}
                onSelect={setSelectedBuilding}
                interactive={!drawing}
              />
            )}
            {outdoor && showItems && mapLayers && (
              <ItemPointsLayer
                buildings={mapLayers.buildings}
                items={mapLayers.items}
                interactive={!drawing}
              />
            )}
            {showHelp && <HelpPointsLayer points={helpPoints} />}
            {canSeeMonitor && showMonitor && <MonitorPointsLayer points={monitorPoints} />}
            {outdoor && showHeatmap && mapLayers && (
              <HeatmapLayer buildings={mapLayers.buildings} items={mapLayers.items} />
            )}
            {outdoor && showAdvice && advice && mapLayers && (
              <AIRecommendLayer buildings={mapLayers.buildings} locations={advice.locations} source={advice.source} degraded={advice.degraded} />
            )}
            <DrawToolLayer tool={tool} />
            {!drawing && <ClickCoordsPopup />}
          </CampusMap>
          {outdoor && selectedBuilding && (
            <BuildingCard
              key={selectedBuilding.id}
              building={selectedBuilding}
              floorLayers={floorLayers}
              onClose={() => setSelectedBuilding(null)}
              onEnterFloor={selectLayer}
            />
          )}
        </div>
      )}
      {layer && tool.hasResult && (
        <div className={styles.publish}>
          <Button type="button" onClick={publish}>
            发布到大厅
          </Button>
        </div>
      )}
      <p className={styles.hint}>
        点击地图获取归一化坐标；建筑层与帖子点位仅在室外底图可用；监控点为模拟数据，仅工作人员可见；
        {layer?.scale_calibrated ? '已标定比例尺' : '未标定比例尺，不换算实际米数'}。
      </p>
    </PageContainer>
  )
}
