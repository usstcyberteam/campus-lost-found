import type { KeyboardEvent } from 'react'
import type { Layer } from '../../types'
import styles from './FloorSwitcher.module.css'

interface FloorSwitcherProps {
  buildingName: string
  floors: Layer[]
  currentId: string
  onSelect: (layerId: string) => void
  onExit: () => void
}

export default function FloorSwitcher({ buildingName, floors, currentId, onSelect, onExit }: FloorSwitcherProps) {
  const sorted = [...floors].sort((a, b) => (a.floor ?? 0) - (b.floor ?? 0))


  function step(delta: number) {
    if (sorted.length === 0) return
    const index = sorted.findIndex((layer) => layer.id === currentId)
    const start = index < 0 ? 0 : index
    const next = sorted[(start + delta + sorted.length) % sorted.length]
    if (next) onSelect(next.id)
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      step(-1)
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      step(1)
    }
  }

  return (
    <nav className={styles.bar} aria-label="楼层切换" onKeyDown={onKeyDown}>
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
      <button type="button" className={styles.button} onClick={onExit}>
        返回室外
      </button>
    </nav>
  )
}