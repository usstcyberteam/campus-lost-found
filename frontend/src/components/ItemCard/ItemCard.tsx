import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { fetchPhotoUrl } from '../../api/uploads'
import { directionLabels, placeLabel, statusLabels, type Item, type ItemStatus } from '../../types'
import Card from '../ui/Card'
import Tag, { type TagTone } from '../ui/Tag'
import styles from './ItemCard.module.css'

const STATUS_TONES: Record<ItemStatus, TagTone> = {
  searching: 'warning',
  pending: 'warning',
  reviewing: 'primary',
  found: 'success',
  returned: 'success',
  withdrawn: 'neutral',
  deleted: 'neutral',
}

function Thumb({ url }: { url: string }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    let active = true
    let created = ''
    fetchPhotoUrl(url)
      .then((objectUrl) => {
        if (!active) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        created = objectUrl
        setSrc(objectUrl)
      })
      .catch(() => {})
    return () => {
      active = false
      if (created) URL.revokeObjectURL(created)
    }
  }, [url])

  if (!src) return <span className={styles.placeholder} aria-hidden="true" />
  return <img className={styles.thumb} src={src} alt="" />
}

export default function ItemCard({ item, extra }: { item: Item; extra?: ReactNode }) {
  return (
    <Link to={`/hall/${item.id}`} className={styles.link}>
      <Card className={styles.card}>
        <div className={styles.thumbWrap}>{item.first_photo && <Thumb url={item.first_photo.url} />}</div>
        <div className={styles.body}>
          <div className={styles.tags}>
            <Tag tone={item.direction === 'lost' ? 'primary' : 'success'}>{directionLabels[item.direction]}</Tag>
            <Tag tone={STATUS_TONES[item.status]}>{statusLabels[item.status]}</Tag>
            {item.is_demo && <Tag tone="neutral">演示</Tag>}
          </div>
          <h3 className={styles.title}>{item.title}</h3>
          <p className={styles.meta}>
            {placeLabel(item)} · {item.category}
          </p>
          <div className={styles.footer}>
            <span>{new Date(item.created_at).toLocaleDateString('zh-CN')}</span>
            <span>赞 {item.like_count}</span>
            <span>评论 {item.comment_count}</span>
            <span>接取 {item.helper_count}</span>
          </div>
          {extra && <div className={styles.extra}>{extra}</div>}
        </div>
      </Card>
    </Link>
  )
}