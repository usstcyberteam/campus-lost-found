import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listItems } from '../../api/items'
import { directionLabels, statusLabels, type Building, type Item, type Layer } from '../../types'
import { errorMessage } from '../../utils/error'
import Button from '../Button'
import Tag from '../Tag'
import styles from './BuildingCard.module.css'

interface BuildingCardProps {
  building: Building
  floorLayers: Layer[]
  onClose: () => void
  onEnterFloor: (layerId: string) => void
}

export default function BuildingCard({ building, floorLayers, onClose, onEnterFloor }: BuildingCardProps) {
  const [items, setItems] = useState<Item[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
        <Tag>{building.category}</Tag>
        <span>共 {building.floors} 层</span>
        <span>进行中 {building.active_item_count} 条</span>
      </div>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={toggleItems} aria-expanded={open}>
          {open ? '收起帖子' : '查看相关帖子'}
        </Button>
        <Button
          variant="primary"
          disabled={floorLayers.length === 0}
          onClick={() => floorLayers[0] && onEnterFloor(floorLayers[0].id)}
        >
          {floorLayers.length === 0 ? '暂无楼层图' : '进入楼层'}
        </Button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {loading && <p className={styles.hint}>加载中…</p>}
      {open && !loading && items.length === 0 && !error && <p className={styles.hint}>暂无进行中的帖子</p>}
      {open && items.length > 0 && (
        <ul className={styles.items}>
          {items.map((item) => (
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