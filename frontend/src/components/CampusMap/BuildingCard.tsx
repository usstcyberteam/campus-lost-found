import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listItems } from '../../api/items'
import { directionLabels, statusLabels, type Building, type Item, type Layer } from '../../types'
import { errorMessage } from '../../utils/error'
import Button from '../Button'
import Tag from '../Tag'
import styles from './BuildingCard.module.css'

type BuildingCardMode = 'flat' | 'iso' | 'floor'

interface BuildingCardProps {
  building: Building
  mode: BuildingCardMode
  floorLayers: Layer[]
  filterFloor?: number | null
  onClose: () => void
  onEnterFloor: (layerId: string) => void
  onLocateOutdoor?: () => void
}

export default function BuildingCard({
  building,
  mode,
  floorLayers,
  filterFloor = null,
  onClose,
  onEnterFloor,
  onLocateOutdoor,
}: BuildingCardProps) {
  const [items, setItems] = useState<Item[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const floors = [...floorLayers].sort((left, right) => (left.floor ?? 0) - (right.floor ?? 0))
  const visible = filterFloor == null ? items : items.filter((item) => item.floor === filterFloor)
  const emptyText = filterFloor == null ? '该建筑暂无相关帖子' : '该楼层暂无相关帖子'

  async function toggleItems() {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    if (items.length > 0) return
    setLoading(true)
    setError('')
    try {
      const page = await listItems({ building_id: building.id, limit: 5 })
      setItems(page.items)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className={styles.card} aria-label={`${building.name}信息`}>
      <div className={styles.head}>
        <h2 className={styles.name}>{building.name}</h2>
        <Button variant="ghost" onClick={onClose} aria-label="关闭建筑卡片">
          关闭
        </Button>
      </div>
      <div className={styles.meta}>
        <Tag>{building.code}</Tag>
        <Tag>{building.category}</Tag>
        <span>共 {building.floors} 层</span>
        <span>进行中 {building.active_item_count} 条</span>
        <span>{floors.length > 0 ? '有楼层图' : '暂无楼层图'}</span>
      </div>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={toggleItems} aria-expanded={open}>
          {open ? '收起帖子' : '查看这栋楼的帖子'}
        </Button>
        {mode !== 'floor' && floors.length > 0 && (
          <Button variant="primary" onClick={() => onEnterFloor(floors[0].id)}>
            进入楼层
          </Button>
        )}
        {mode === 'iso' && onLocateOutdoor && (
          <Button variant="secondary" onClick={onLocateOutdoor}>
            在室外地图定位
          </Button>
        )}
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {loading && <p className={styles.hint}>加载中…</p>}
      {open && !loading && visible.length === 0 && !error && <p className={styles.hint}>{emptyText}</p>}
      {open && visible.length > 0 && (
        <ul className={styles.items}>
          {visible.map((item) => (
            <li key={item.id}>
              <Link className={styles.itemLink} to={`/hall/${item.id}`}>
                <span>
                  {directionLabels[item.direction]} · {item.title}
                </span>
                <span className={styles.itemMeta}>{statusLabels[item.status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}