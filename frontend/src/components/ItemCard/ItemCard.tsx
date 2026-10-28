import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { fetchPhotoUrl } from '../../api/uploads'
import { directionLabels, placeLabel, statusLabels, type Item } from '../../types'
import { STAMP_TONES, caseNumber, categoryArt } from '../../utils/itemTone'
import Card from '../ui/Card'
import Tag from '../ui/Tag'
import styles from './ItemCard.module.css'

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

  if (!src) return null
  return <img className={styles.thumb} src={src} alt="" />
}

export default function ItemCard({ item, extra }: { item: Item; extra?: ReactNode }) {
  return (
    <Link to={`/hall/${item.id}`} className={styles.link}>
      <span className={styles.tab}>{caseNumber(item)}</span>
      <Card className={styles.card}>
        {/* 证物：有照片放照片（加一枚证物签），没有就放类别插画 */}
        <div className={`${styles.evidence} ${item.first_photo ? styles.withPhoto : ''}`}>
          <img className={styles.art} src={categoryArt(item.category)} alt="" loading="lazy" />
          {item.first_photo && <Thumb url={item.first_photo.url} />}
        </div>
        <div className={styles.body}>
          <div className={styles.tags}>
            <Tag tone={item.direction}>{directionLabels[item.direction]}</Tag>
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
        <span className={`${styles.stamp} ${styles[STAMP_TONES[item.status]]}`}>{statusLabels[item.status]}</span>
      </Card>
    </Link>
  )
}
