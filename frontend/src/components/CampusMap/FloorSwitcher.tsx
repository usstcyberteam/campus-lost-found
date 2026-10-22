import type { Layer } from '../../types'
import styles from './FloorSwitcher.module.css'

interface FloorSwitcherProps {
  buildingName: string
  floors: Layer[]
  currentId: string
  outdoorId: string | null
  onSelect: (layerId: string) => void
}

export default function FloorSwitcher({ buildingName, floors, currentId, outdoorId, onSelect }: FloorSwitcherProps) {
  const sorted = [...floors].sort((a, b) => (a.floor ?? 0) - (b.floor ?? 0))

  return (
    <nav className={styles.bar} aria-label="楼层切换">
      <span className={styles.name}>{buildingName}</span>
      <div className={styles.floors}>
        {sorted.map((layer) => (
          <button
            key={layer.id}
            type="button"
            className={`${styles.button} ${layer.id === currentId ? styles.active : ''}`}
            aria-pressed={layer.id === currentId}
            onClick={() => onSelect(layer.id)}
          >
            {layer.floor != null ? `${layer.floor}F` : layer.name}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={styles.button}
        onClick={() => outdoorId && onSelect(outdoorId)}
        disabled={outdoorId === null}
      >
        返回室外
      </button>
    </nav>
  )
}