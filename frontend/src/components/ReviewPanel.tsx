import Button from './ui/Button'
import Badge from './ui/Badge'
import Tag from './ui/Tag'
import { Link } from 'react-router-dom'
import { claimStatusLabels, type ClaimDetail, type Item } from '../types'
import styles from './ReviewPanel.module.css'

interface Props {
  detail: ClaimDetail
  foundItem: Item | null
  busy: boolean
  onApprove: () => void
  onReject: () => void
  onComplete: () => void
}

export default function ReviewPanel({ detail, foundItem, busy, onApprove, onReject, onComplete }: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{foundItem?.title || '拾获物品'}</h2>
        <Badge variant={detail.status === 'pending' ? 'coral' : detail.status === 'approved' ? 'mint' : detail.status === 'completed' ? 'mint' : 'danger'}>
          {claimStatusLabels[detail.status]}
        </Badge>
      </div>

      {foundItem && (
        <div className={styles.itemInfo}>
          <p className={styles.meta}>{foundItem.category} · {foundItem.location_area || '未知地点'}</p>
          {foundItem.description && <p className={styles.description}>{foundItem.description}</p>}
          <Link to={`/items/${detail.found_item_id}`} className={styles.link}>查看拾获详情</Link>
        </div>
      )}

      {detail.lost_item_id && (
        <div className={styles.relatedLost}>
          <Link to={`/items/${detail.lost_item_id}`} className={styles.link}>查看关联寻物</Link>
        </div>
      )}

      <div className={styles.evidenceSection}>
        <div className={styles.evidenceHeader}>
          <h3 className={styles.evidenceTitle}>私密认领证据</h3>
          <Tag variant="secondary">私密</Tag>
        </div>
        {detail.evidence.map((e, i) => (
          <p key={i} className={styles.evidenceItem}>
            {e.kind === 'image' ? '图片证据说明：' : ''}{e.content}
          </p>
        ))}
      </div>

      {detail.status === 'pending' && (
        <div className={styles.actions}>
          <Button variant="primary" disabled={busy} onClick={onApprove}>通过核验</Button>
          <Button variant="danger" disabled={busy} onClick={onReject}>拒绝申请</Button>
        </div>
      )}

      {detail.status === 'approved' && (
        <Button variant="primary" disabled={busy} onClick={onComplete}>确认已交接归还</Button>
      )}
    </div>
  )
}
