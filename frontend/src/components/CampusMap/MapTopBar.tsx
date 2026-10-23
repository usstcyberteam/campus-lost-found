import type { ReactNode } from 'react'
import styles from './MapTopBar.module.css'

export type MapViewMode = 'flat' | 'iso' | 'floor'

export const MAP_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'hot', label: '热门' },
  { key: 'near', label: '附近' },
] as const

export type MapFilterKey = (typeof MAP_FILTERS)[number]['key']

interface MapTopBarProps {
  view: MapViewMode
  canUseIso: boolean
  onSwitchView: (view: 'flat' | 'iso') => void
  query: string
  onQueryChange: (value: string) => void
  filter: MapFilterKey
  onFilterChange: (filter: MapFilterKey) => void
  /** 地图级错误提示：放在顶部悬浮区，避免被底部抽屉遮挡 */
  notice?: ReactNode
  /** 楼层视图的楼层切换条等附加内容，排在搜索区下方 */
  children?: ReactNode
}

// 顶部悬浮区：室外/室内分段切换 + 搜索 + 筛选；分段切换固定在最上方，向下展开不遮挡搜索框
export default function MapTopBar({
  view,
  canUseIso,
  onSwitchView,
  query,
  onQueryChange,
  filter,
  onFilterChange,
  notice,
  children,
}: MapTopBarProps) {
  const indoorActive = view === 'iso'

  return (
    <div className={styles.overlayTop}>
      <div className={styles.segment} role="group" aria-label="地图视图">
        <button
          type="button"
          className={`${styles.segmentButton} ${indoorActive ? '' : styles.segmentActive}`}
          aria-pressed={!indoorActive}
          onClick={() => onSwitchView('flat')}
        >
          室外
        </button>
        <button
          type="button"
          className={`${styles.segmentButton} ${indoorActive ? styles.segmentActive : ''}`}
          aria-pressed={indoorActive}
          disabled={!canUseIso}
          onClick={() => onSwitchView('iso')}
        >
          室内
        </button>
      </div>
      <input
        className={styles.search}
        aria-label="搜索建筑"
        placeholder="搜索建筑 / 类别"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <div className={styles.chips} role="group" aria-label="结果筛选">
        {MAP_FILTERS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className={`${styles.chip} ${filter === chip.key ? styles.chipActive : ''}`}
            aria-pressed={filter === chip.key}
            onClick={() => onFilterChange(chip.key)}
          >
            {chip.label}
          </button>
        ))}
      </div>
      {notice && <div className={styles.notice}>{notice}</div>}
      {children && <div className={styles.extra}>{children}</div>}
    </div>
  )
}