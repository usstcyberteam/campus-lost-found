import { listBuildings } from '../api/buildings'
import { listItems } from '../api/items'
import type { Building, Item, ItemStatus } from '../types'
import { useAsync, type AsyncState } from './useAsync'

const ACTIVE_STATUSES: ItemStatus[] = ['searching', 'pending', 'reviewing']

export interface CampusMapLayerData {
  buildings: Building[]
  items: Item[]
}

// 点位只取对地图有意义的进行中帖子；坐标由建筑位置推导，不暴露帖子精确位置
export function useCampusMapLayers(): AsyncState<CampusMapLayerData> {
  return useAsync(async () => {
    const [buildings, items] = await Promise.all([listBuildings({ limit: 100 }), listItems({ limit: 100 })])
    return {
      buildings: buildings.items,
      items: items.items.filter((item) => ACTIVE_STATUSES.includes(item.status)),
    }
  }, [])
}