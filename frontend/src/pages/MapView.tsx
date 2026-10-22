import { useEffect, useMemo, useRef, useState } from 'react'
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
const DRAWER_TABS = [
  { key: 'results', label: '结果' },
  { key: 'layers', label: '图层' },
  { key: 'tools', label: '工具' },
] as const
const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'hot', label: '热门' },
  { key: 'near', label: '附近' },
] as const

type DrawerTab = (typeof DRAWER_TABS)[number]['key']
type FilterKey = (typeof FILTERS)[number]['key']

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

function buildingPoint(building: Building): { x: number; y: number } | null {
  if (building.label_position) {
    return { x: Number(building.label_position.x), y: Number(building.label_position.y) }
  }
  const region = building.click_region
  if (!region || region.length === 0) return null
  const sum = region.reduce(
    (acc, point) => ({ x: acc.x + Number(point.x), y: acc.y + Number(point.y) }),
    { x: 0, y: 0 },
  )
  return { x: sum.x / region.length, y: sum.y / region.length }
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
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('results')
  const [expanded, setExpanded] = useState(false)
  const [focus, setFocus] = useState<{ x: number; y: number; token: number } | null>(null)
  const dragRef = useRef<{ y: number } | null>(null)
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

  // 结果列表：搜索过滤 + 全部/热门/附近 排序
  const results = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const list = (mapLayers?.buildings ?? []).filter((building) => {
      if (!keyword) return true
      return (
        building.name.toLowerCase().includes(keyword) ||
        building.code.toLowerCase().includes(keyword) ||
        building.category.toLowerCase().includes(keyword)
      )
    })
    if (filter === 'hot') {
      return [...list].sort((a, b) => b.active_item_count - a.active_item_count)
    }
    if (filter === 'near') {
      const anchor = tool.point ?? (selectedBuilding ? buildingPoint(selectedBuilding) : null)
      if (anchor) {
        return [...list].sort((a, b) => {
          const pa = buildingPoint(a)
          const pb = buildingPoint(b)
          const da = pa ? Math.hypot(pa.x - anchor.x, pa.y - anchor.y) : Number.POSITIVE_INFINITY
          const db = pb ? Math.hypot(pb.x - anchor.x, pb.y - anchor.y) : Number.POSITIVE_INFINITY
          return da - db
        })
      }
    }
    return list
  }, [mapLayers, query, filter, tool.point, selectedBuilding])

  const nearUnavailable = filter === 'near' && !tool.point && !selectedBuilding

  function selectLayer(layerId: string) {
    tool.clear()
    setSelected(layerId)
    setSelectedBuilding(null)
  }

  function focusBuilding(building: Building) {
    setSelectedBuilding(building)
    setDrawerTab('results')
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
    <div className={styles.page}>
      <div className={styles.mapWrap}>
        {layer ? (
          <CampusMap
            layer={layer}
            markers={NO_MARKERS}
            focus={focus}
            onMapClick={() => setSelectedBuilding(null)}
            onImageError={setImageError}
          >
            {outdoor && showBuildings && mapLayers && (
              <BuildingLayer
                buildings={mapLayers.buildings}
                selectedId={selectedBuilding?.id ?? null}
                onSelect={focusBuilding}
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
        ) : (
          <div className={styles.mapEmpty}>
            {(!layers || layers.length === 0) && !layersError ? '暂无图层，请先初始化地图数据。' : '正在加载地图…'}
          </div>
        )}

        {/* 顶部悬浮搜索 + 筛选 chips */}
        <div className={styles.overlayTop}>
          <input
            className={styles.search}
            aria-label="搜索建筑"
            placeholder="搜索建筑 / 类别"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className={styles.chips} role="group" aria-label="结果筛选">
            {FILTERS.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className={`${styles.chip} ${filter === chip.key ? styles.chipActive : ''}`}
                aria-pressed={filter === chip.key}
                onClick={() => setFilter(chip.key)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {outdoor && selectedBuilding && (
          <div className={styles.buildingCard}>
            <BuildingCard
              key={selectedBuilding.id}
              building={selectedBuilding}
              floorLayers={floorLayers}
              onClose={() => setSelectedBuilding(null)}
              onEnterFloor={selectLayer}
            />
          </div>
        )}

        {(imageError || adviceError) && (
          <div className={styles.mapNotice}>
            <ErrorNotice message={imageError || adviceError} />
          </div>
        )}
      </div>

      {/* 底部可拖拽抽屉 */}
      <section className={`${styles.drawer} ${expanded ? styles.drawerExpanded : ''}`} aria-label="地图结果与设置">
        <div
          className={styles.handle}
          role="button"
          tabIndex={0}
          aria-label={expanded ? '收起面板' : '展开面板'}
          aria-expanded={expanded}
          onPointerDown={(event) => {
            dragRef.current = { y: event.clientY }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (!dragRef.current) return
            const dy = dragRef.current.y - event.clientY
            if (dy > 40 || dy < -40) {
              setExpanded(dy > 0)
              dragRef.current = null
            }
          }}
          onPointerUp={() => {
            dragRef.current = null
          }}
          onClick={() => setExpanded((value) => !value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') setExpanded((value) => !value)
          }}
        >
          <span className={styles.handleBar} aria-hidden="true" />
        </div>

        <div className={styles.tabs} role="tablist" aria-label="地图面板">
          {DRAWER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={drawerTab === tab.key}
              className={`${styles.tab} ${drawerTab === tab.key ? styles.tabActive : ''}`}
              onClick={() => {
                setDrawerTab(tab.key)
                setExpanded(true)
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.drawerBody}>
          {drawerTab === 'results' && (
            <>
              {nearUnavailable && <p className={styles.note}>「附近」需要一个参照点：点击地图上的建筑或先标一个点。</p>}
              {results.length === 0 ? (
                <p className={styles.empty}>没有匹配的建筑，试试其它关键词。</p>
              ) : (
                <ul className={styles.results}>
                  {results.map((building) => (
                    <li key={building.id}>
                      <button
                        type="button"
                        className={`${styles.resultItem} ${selectedBuilding?.id === building.id ? styles.resultActive : ''}`}
                        onClick={() => focusBuilding(building)}
                      >
                        <span className={styles.resultName}>{building.name}</span>
                        <span className={styles.resultMeta}>
                          {building.category}
                          {building.active_item_count > 0 && (
                            <span className={styles.resultBadge}>进行中 {building.active_item_count}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {drawerTab === 'layers' && (
            <div className={styles.panel}>
              {layersError && <ErrorNotice message={layersError} />}
              {mapLayersError && <ErrorNotice message={mapLayersError} />}
              {pointsError && <ErrorNotice message={pointsError} />}
              <select value={selected} onChange={(event) => selectLayer(event.target.value)} aria-label="选择图层">
                {layers?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.scale_calibrated ? '（已标定）' : '（未标定，不显示米数）'}
                  </option>
                ))}
              </select>
              {currentBuilding && currentFloorLayers.length > 0 && (
                <FloorSwitcher
                  buildingName={currentBuilding.name}
                  floors={currentFloorLayers}
                  currentId={selected}
                  outdoorId={outdoorLayerId}
                  onSelect={selectLayer}
                />
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
            </div>
          )}

          {drawerTab === 'tools' && (
            <div className={styles.panel}>
              {layer ? (
                <>
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
                  {tool.hasResult && tool.routeKind && (
                    <div className={styles.visibility}>
                      <label className={styles.visibilityLabel}>
                        路线可见性
                        <select
                          value={tool.visibility}
                          onChange={(event) => tool.setVisibility(event.target.value as Visibility)}
                        >
                          <option value="private">私密（仅自己与已授权处理人员）</option>
                          <option value="public">公开</option>
                        </select>
                      </label>
                      <span className={styles.note}>圈选默认公开，路径默认私密</span>
                    </div>
                  )}
                  {tool.hasResult && (
                    <Button type="button" onClick={publish}>
                      发布到大厅
                    </Button>
                  )}
                  <p className={styles.note}>
                    点击地图获取归一化坐标；建筑层与帖子点位仅在室外底图可用；监控点为模拟数据，仅工作人员可见；
                    {layer.scale_calibrated ? '已标定比例尺' : '未标定比例尺，不换算实际米数'}。
                  </p>
                </>
              ) : (
                <p className={styles.empty}>地图加载后可在此标点、圈范围、画路径。</p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}