import type { MapLayerSwitches } from './MapCanvas'

const MAP_STATE_KEY = 'campus-map-view'

interface StoredMapSwitches {
  showBuildings?: boolean
  showItems?: boolean
  showHelp?: boolean
  showMonitor?: boolean
  showAdvice?: boolean
  showHeatmap?: boolean
  showLabels?: boolean
}

export function readStoredSwitches(): StoredMapSwitches {
  try {
    return JSON.parse(sessionStorage.getItem(MAP_STATE_KEY) ?? '{}') as StoredMapSwitches
  } catch {
    return {}
  }
}

// 隐私模式下写入可能失败，不影响地图使用
export function saveStoredSwitches(show: MapLayerSwitches): void {
  try {
    sessionStorage.setItem(
      MAP_STATE_KEY,
      JSON.stringify({
        showBuildings: show.buildings,
        showItems: show.items,
        showHelp: show.help,
        showMonitor: show.monitor,
        showAdvice: show.advice,
        showHeatmap: show.heatmap,
        showLabels: show.labels,
      }),
    )
  } catch {
    /* 忽略存储失败 */
  }
}