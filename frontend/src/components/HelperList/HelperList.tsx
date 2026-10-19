import { useEffect, useState } from 'react'
import type { HelperUser } from '../../types'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import Tag from '../ui/Tag'
import ThankDialog from './ThankDialog'
import styles from './HelperList.module.css'

interface HelperListProps {
  itemId: string
  helpers: HelperUser[]
  canThank: boolean
}

export default function HelperList({ itemId, helpers, canThank }: HelperListProps) {
  const [open, setOpen] = useState(false)
  const [thankedIds, setThankedIds] = useState<string[]>([])

  useEffect(() => {
    setThankedIds([])
    setOpen(false)
  }, [itemId])

  const rows = helpers.map((helper) => ({
    ...helper,
    thanked: helper.thanked || thankedIds.includes(helper.id),
  }))
  const pending = rows.filter((helper) => !helper.thanked)

  return (
    <section className={styles.section} aria-labelledby="helper-heading">
      <div className={styles.header}>
        <h2 id="helper-heading">协助者 · {rows.length} 人</h2>
        {canThank && pending.length > 0 && (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            致谢协助者
          </Button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className={styles.empty}>暂无协助者</p>
      ) : (
        <ul className={styles.list}>
          {rows.map((helper) => (
            <li key={helper.id} className={styles.item}>
              <Avatar name={helper.display_name} size="sm" />
              <span className={styles.name}>{helper.display_name}</span>
              <Tag tone="primary">{helper.title}</Tag>
              {helper.thanked && <Tag tone="success">已致谢</Tag>}
            </li>
          ))}
        </ul>
      )}
      {open && (
        <ThankDialog
          itemId={itemId}
          helpers={rows}
          onClose={() => setOpen(false)}
          onThanked={(ids) => {
            setThankedIds(ids)
            setOpen(false)
          }}
        />
      )}
    </section>
  )
}