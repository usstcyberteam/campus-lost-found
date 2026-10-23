import { useState } from 'react'
import { listItems } from '../../api/items'
import { errorMessage } from '../../utils/error'
import type { Item } from '../../types'
import ItemCard from './ItemCard'
import styles from './ItemGroup.module.css'

const GROUP_FETCH_LIMIT = 100

interface ItemGroupProps {
  item: Item
  siblings: Item[]
}

/** 相似帖折叠卡片：主帖正常展示，组内其余帖子折叠，点开按需拉取全组。 */
export default function ItemGroup({ item, siblings }: ItemGroupProps) {
  const [open, setOpen] = useState(false)
  const [remote, setRemote] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const relatedTotal = Math.max(item.group_count - 1, siblings.length)
  const localIds = new Set([item.id, ...siblings.map((row) => row.id)])
  const rest = [...siblings, ...remote.filter((row) => !localIds.has(row.id))]

  async function toggle() {
    const next = !open
    setOpen(next)
    if (!next || !item.group_id || remote.length > 0 || rest.length >= relatedTotal) return
    setLoading(true)
    setError('')
    try {
      const page = await listItems({ group_id: item.group_id, limit: GROUP_FETCH_LIMIT })
      setRemote(page.items.filter((row) => row.id !== item.id))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.group}>
      <ItemCard item={item} />
      {relatedTotal > 0 && (
        <button type="button" className={styles.toggle} onClick={toggle} aria-expanded={open}>
          {relatedTotal}条相关帖子
          <span className={styles.toggleHint}>{open ? '收起' : '展开'}</span>
        </button>
      )}
      {open && (
        <ul className={styles.siblings}>
          {rest.map((row) => (
            <li key={row.id} className={styles.sibling}>
              <ItemCard item={row} />
            </li>
          ))}
          {loading && <li className={styles.state}>正在加载相关帖子…</li>}
        </ul>
      )}
      {open && error && <p className={styles.error}>{error}</p>}
    </div>
  )
}