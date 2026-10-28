import { useState } from 'react'
import { getMapMeta } from '../../api/layers'
import { useAsync } from '../../hooks/useAsync'
import { useCampusMapLayers } from '../../hooks/useCampusMapLayers'
import { useLayers } from '../../hooks/useLayers'
import BuildingLayer from '../CampusMap/BuildingLayer'
import CampusMap, { type MapMarker } from '../CampusMap/CampusMap'
import IndoorLayers from '../CampusMap/IndoorLayers'
import MapErrorBoundary from '../CampusMap/MapErrorBoundary'
import { flatBuildingAt, isoBuildingAt } from '../CampusMap/coords'
import styles from './LocationPicker.module.css'

/** 选中的位置：坐标一律是室外平面图的归一化坐标；2.5D 只用来点选整栋楼，不产生坐标 */
export interface PickedLocation {
  buildingId: string | null
  buildingName: string | null
  floor: number | null
  point: { x: number; y: number } | null
  /** 平面图图层 id，point 存在时才有意义 */
  layerId: string | null
}

export const EMPTY_PICK: PickedLocation = {
  buildingId: null,
  buildingName: null,
  floor: null,
  point: null,
  layerId: null,
}

type PickerView = 'flat' | 'iso'

const NO_CODES: string[] = []

function markerColor(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim()
}
// 嵌在表单里：地图上下没有浮层压着
const FORM_INSET = { top: 0, bottom: 0 }

interface LocationPickerProps {
  value: PickedLocation
  onChange: (next: PickedLocation) => void
}

/** 发布页的地图选点：室外平面点到具体位置，室内 2.5D 点选整栋楼；选中楼后可选楼层。 */
export default function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [view, setView] = useState<PickerView>('flat')
  const [hint, setHint] = useState('')
  const { data: layers, error: layersError } = useLayers()
  const { data: mapData } = useCampusMapLayers()
  const { data: meta } = useAsync(() => getMapMeta(), [])

  const buildings = mapData?.buildings ?? []
  const flatLayer = layers?.find((layer) => layer.id === meta?.flat_layer_id) ?? null
  const isoLayer = layers?.find((layer) => layer.id === meta?.iso_layer_id) ?? null
  const layer = view === 'iso' && isoLayer ? isoLayer : flatLayer
  const selected = buildings.find((building) => building.id === value.buildingId) ?? null
  const floorOptions = selected ? Array.from({ length: Math.max(selected.floors, 0) }, (_, index) => index + 1) : []

  // 只有落在室外平面图上的点才画（从楼层视图带来的点坐标系不同）
  const markers: MapMarker[] =
    view === 'flat' && value.point && value.layerId === flatLayer?.id
      ? [{ x: value.point.x, y: value.point.y, label: selected?.name ?? '选中的位置', color: markerColor() }]
      : []

  function handleClick(point: { x: number; y: number }) {
    if (view === 'iso') {
      const building = isoBuildingAt(point, buildings)
      if (!building) {
        setHint('2.5D 视图里请点在楼上；要选楼外的具体位置，切到室外平面')
        return
      }
      setHint('')
      // 只记到楼：不拿楼中心冒充具体标点
      onChange({
        buildingId: building.id,
        buildingName: building.name,
        floor: building.id === value.buildingId ? value.floor : null,
        point: null,
        layerId: null,
      })
      return
    }
    const building = flatBuildingAt(point, buildings)
    setHint('')
    onChange({
      buildingId: building?.id ?? null,
      buildingName: building?.name ?? null,
      floor: building && building.id === value.buildingId ? value.floor : null,
      point,
      layerId: flatLayer?.id ?? null,
    })
  }

  if (layersError) return <p className={styles.note}>地图加载失败，可直接在下方填写地点。</p>
  if (!layer) return <div className={styles.skeleton} aria-hidden="true" />

  const summary = value.buildingName
    ? `${value.buildingName}${value.floor != null ? ` · ${value.floor}F` : ''}`
    : value.point
      ? '楼外位置（已标点）'
      : '还没选，点地图上的位置或楼'

  return (
    <div className={styles.picker}>
      <div className={styles.toolbar}>
        <div className={styles.segment} role="group" aria-label="地图视图">
          <button
            type="button"
            className={view === 'flat' ? styles.segmentActive : ''}
            aria-pressed={view === 'flat'}
            onClick={() => setView('flat')}
          >
            室外平面
          </button>
          <button
            type="button"
            className={view === 'iso' ? styles.segmentActive : ''}
            aria-pressed={view === 'iso'}
            disabled={!isoLayer}
            onClick={() => setView('iso')}
          >
            室内 2.5D
          </button>
        </div>
        {(value.buildingId || value.point) && (
          <button type="button" className={styles.clear} onClick={() => onChange(EMPTY_PICK)}>
            清除
          </button>
        )}
      </div>

      <div className={styles.mapBox}>
        <MapErrorBoundary>
          <CampusMap layer={layer} markers={markers} onMapClick={handleClick} fitInset={FORM_INSET} wheelZoom={false}>
            {view === 'flat' ? (
              <BuildingLayer buildings={buildings} selectedId={value.buildingId} recommendedCodes={NO_CODES} />
            ) : (
              <IndoorLayers
                buildings={buildings}
                matrix={meta?.flat_to_iso ?? null}
                selectedId={value.buildingId}
                recommendedCodes={NO_CODES}
                showBuildings
                showAdvice={false}
                showLabels={false}
              />
            )}
          </CampusMap>
        </MapErrorBoundary>
      </div>

      <div className={styles.status}>
        <span className={styles.summary} aria-live="polite">
          {summary}
        </span>
        {floorOptions.length > 0 && (
          <label className={styles.floor}>
            楼层
            <select
              value={value.floor ?? ''}
              onChange={(e) => onChange({ ...value, floor: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">不确定</option>
              {floorOptions.map((floor) => (
                <option key={floor} value={floor}>
                  {floor}F
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className={styles.note}>
        {hint ||
          '拖动、缩放地图找位置：室外平面可以点到具体地点，2.5D 视图点楼只选整栋。标点会显示在帖子详情的小地图上，分享卡片只标到楼；不想公开具体位置就只选楼。'}
      </p>
    </div>
  )
}
