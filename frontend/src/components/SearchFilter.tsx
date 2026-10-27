import { useState } from 'react'
import type { Direction, ItemStatus } from '../types'
import { statusLabels } from '../types'
import styles from './SearchFilter.module.css'

interface Props {
  direction: Direction | ''
  category: string
  status: ItemStatus | ''
  onDirectionChange: (value: Direction | '') => void
  onCategoryChange: (value: string) => void
  onStatusChange: (value: ItemStatus | '') => void
}

export default function SearchFilter({ direction, category, status, onDirectionChange, onCategoryChange, onStatusChange }: Props) {
  const [expanded, setExpanded] = useState(false)

  const hasAdvancedFilter = status !== ''
  const activeFilters: string[] = []
  if (direction) activeFilters.push(direction === 'lost' ? '寻物' : '拾获')
  if (category) activeFilters.push(category)
  if (status) activeFilters.push(statusLabels[status])

  function clearAll() {
    onDirectionChange('')
    onCategoryChange('')
    onStatusChange('')
  }

  return (
    <div className={styles.container}>
      <div className={styles.primaryRow}>
        <div className={styles.searchBox}>
          <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            className={styles.searchInput}
            placeholder="搜索类别（如 雨伞）"
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            aria-label="搜索类别"
          />
          {category && (
            <button className={styles.clearBtn} onClick={() => onCategoryChange('')} aria-label="清除搜索">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${direction === '' ? styles.tabActive : ''}`}
            onClick={() => onDirectionChange('')}
          >全部</button>
          <button
            className={`${styles.tab} ${direction === 'lost' ? styles.tabActive : ''}`}
            onClick={() => onDirectionChange('lost')}
          >寻物</button>
          <button
            className={`${styles.tab} ${direction === 'found' ? styles.tabActive : ''}`}
            onClick={() => onDirectionChange('found')}
          >拾获</button>
        </div>

        <button
          className={`${styles.moreBtn} ${hasAdvancedFilter ? styles.moreBtnActive : ''}`}
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          更多筛选
          {hasAdvancedFilter && <span className={styles.filterDot} />}
        </button>
      </div>

      {expanded && (
        <div className={styles.advancedRow}>
          <label className={styles.advancedLabel}>
            状态
            <select
              className={styles.advancedSelect}
              value={status}
              onChange={(e) => onStatusChange(e.target.value as ItemStatus | '')}
              aria-label="筛选状态"
            >
              <option value="">全部状态</option>
              {Object.entries(statusLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {activeFilters.length > 0 && (
        <div className={styles.activeFilters}>
          {activeFilters.map((f, i) => (
            <span key={i} className={styles.filterTag}>{f}</span>
          ))}
          <button className={styles.clearAllBtn} onClick={clearAll}>清除全部</button>
        </div>
      )}
    </div>
  )
}
