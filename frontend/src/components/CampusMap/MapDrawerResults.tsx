import type { Building } from '../../types'
import styles from './MapDrawer.module.css'

interface MapDrawerResultsProps {
  results: Building[]
  nearUnavailable: boolean
  selectedId: string | null
  onSelectBuilding: (building: Building) => void
}

export default function MapDrawerResults({
  results,
  nearUnavailable,
  selectedId,
  onSelectBuilding,
}: MapDrawerResultsProps) {
  return (
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
                className={`${styles.resultItem} ${selectedId === building.id ? styles.resultActive : ''}`}
                onClick={() => onSelectBuilding(building)}
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
  )
}