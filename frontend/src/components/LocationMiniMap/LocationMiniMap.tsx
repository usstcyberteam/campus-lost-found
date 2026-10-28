import { Link } from 'react-router-dom'
import { getBuilding } from '../../api/buildings'
import { useAsync } from '../../hooks/useAsync'
import type { Item } from '../../types'
import { buildingPoint } from '../CampusMap/mapResults'
import { loadFlatMap, toPixel } from './flatMap'
import styles from './LocationMiniMap.module.css'

// 视窗宽度占整张平面图的比例：约能看到目标楼和周边一两栋楼
const VIEW_RATIO = 0.3

/** 帖子详情里的定位小地图：截取平面图上帖子所在的一小块，点开进完整地图。 */
export default function LocationMiniMap({ item }: { item: Item }) {
  const flat = useAsync(() => loadFlatMap(), [])
  const building = useAsync(
    () => (item.building_id ? getBuilding(item.building_id) : Promise.resolve(null)),
    [item.building_id],
  )

  const layer = flat.data?.layer
  // 帖子在室外平面图上标过点就用标点，否则退回"范围到楼"
  const precise =
    layer && item.layer_id === layer.id && item.norm_x != null && item.norm_y != null
      ? { x: item.norm_x, y: item.norm_y }
      : null
  const point = precise ?? (building.data ? buildingPoint(building.data) : null)
  if (!item.building_id && !precise) return null
  if (!layer || !flat.data || !point) {
    return flat.error || building.error ? null : <div className={styles.skeleton} aria-hidden="true" />
  }

  const { width, height } = layer
  const viewW = width * VIEW_RATIO
  const viewH = viewW / 2
  const { x: cx, y: cy } = toPixel(layer, point)
  const region = building.data?.click_region
    ?.map((p) => toPixel(layer, { x: Number(p.x), y: Number(p.y) }))
    .map((p) => `${p.x},${p.y}`)
    .join(' ')
  const name = building.data?.name ?? '帖子位置'

  return (
    <Link
      className={styles.wrap}
      to={item.building_id ? `/map?building=${item.building_id}` : '/map'}
      aria-label={`在地图上查看：${name}`}
    >
      <svg
        className={styles.svg}
        viewBox={`${cx - viewW / 2} ${cy - viewH / 2} ${viewW} ${viewH}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <image href={flat.data.url} width={width} height={height} />
        {region && <polygon className={styles.region} points={region} vectorEffect="non-scaling-stroke" />}
      </svg>
      {/* 目标点恰好在视窗正中，图钉直接居中摆放 */}
      <span className={`${styles.pin} ${precise ? styles.pinPrecise : ''}`} aria-hidden="true" />
      <span className={styles.label}>
        {name}
        <span className={styles.scope}>{precise ? '精确位置' : '范围到楼'}</span>
      </span>
      <span className={styles.open}>打开地图</span>
    </Link>
  )
}
