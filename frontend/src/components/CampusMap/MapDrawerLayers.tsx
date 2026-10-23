import ErrorNotice from '../ErrorNotice'
import LayerToggles, { type LayerToggleOption } from './LayerToggles'
import type { MapLayerSwitches } from './MapCanvas'
import type { MapViewMode } from './MapTopBar'
import styles from './MapDrawer.module.css'

interface MapDrawerLayersProps {
  view: MapViewMode
  switches: MapLayerSwitches
  onToggle: (key: keyof MapLayerSwitches, checked: boolean) => void
  canSeeMonitor: boolean
  adviceReady: boolean
  layersError: string
  mapLayersError: string
  pointsError: string
}

// 图层开关面板：建筑与帖子点位只在室外可用，2.5D 视图只看楼
export default function MapDrawerLayers({
  view,
  switches,
  onToggle,
  canSeeMonitor,
  adviceReady,
  layersError,
  mapLayersError,
  pointsError,
}: MapDrawerLayersProps) {
  const outdoor = view === 'flat'
  const floor = view === 'floor'

  const options: LayerToggleOption[] = [
    {
      key: 'buildings',
      label: '建筑层',
      checked: switches.buildings,
      disabled: floor,
      onChange: (checked) => onToggle('buildings', checked),
    },
    {
      key: 'items',
      label: '帖子点位',
      checked: switches.items,
      disabled: !outdoor,
      onChange: (checked) => onToggle('items', checked),
    },
    {
      key: 'help',
      label: '求助点位',
      checked: switches.help,
      disabled: !outdoor,
      onChange: (checked) => onToggle('help', checked),
    },
    ...(canSeeMonitor
      ? [
          {
            key: 'monitor',
            label: '监控点位（模拟）',
            checked: switches.monitor,
            disabled: !outdoor,
            onChange: (checked: boolean) => onToggle('monitor', checked),
          },
        ]
      : []),
    {
      key: 'advice',
      label: 'AI 推荐层',
      checked: switches.advice,
      disabled: floor || !adviceReady,
      onChange: (checked) => onToggle('advice', checked),
    },
    {
      key: 'heatmap',
      label: '热力层',
      checked: switches.heatmap,
      disabled: !outdoor,
      onChange: (checked) => onToggle('heatmap', checked),
    },
    {
      key: 'labels',
      label: '显示楼名',
      checked: switches.labels,
      disabled: floor,
      onChange: (checked) => onToggle('labels', checked),
    },
  ]

  return (
    <div className={styles.panel}>
      {layersError && <ErrorNotice message={layersError} />}
      {mapLayersError && <ErrorNotice message={mapLayersError} />}
      {pointsError && <ErrorNotice message={pointsError} />}
      <LayerToggles options={options} />
      <p className={styles.note}>
        建筑与帖子点位仅在室外底图可用；2.5D 视图只用于选楼；监控点为模拟数据，仅工作人员可见。
      </p>
    </div>
  )
}