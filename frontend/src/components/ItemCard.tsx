import { Link } from 'react-router-dom'
import { directionLabels, type Item } from '../types'
import StatusBadge from './ui/StatusBadge'
import Tag from './ui/Tag'
import styles from './ItemCard.module.css'

interface Props {
  item: Item
  onClick?: () => void
}

export default function ItemCard({ item, onClick }: Props) {
  const isLost = item.direction === 'lost'

  return (
    <Link to={`/items/${item.id}`} className={styles.cardLink} onClick={onClick}>
      <article className={`${styles.card} ${isLost ? styles.lostCard : styles.foundCard}`}>
        <div className={styles.typeBar} aria-hidden="true" />
        <div className={styles.content}>
          <div className={styles.header}>
            <Tag variant={isLost ? 'coral' : 'mint'}>{directionLabels[item.direction]}</Tag>
            {item.is_simulated && <Tag variant="secondary">模拟</Tag>}
          </div>
          <h3 className={styles.title}>{item.title}</h3>
          <div className={styles.meta}>
            <span className={styles.category}>{item.category}</span>
            <span className={styles.dot} aria-hidden="true">·</span>
            <span className={styles.location}>{item.location_area || '未知地点'}</span>
          </div>
          <div className={styles.footer}>
            <StatusBadge status={item.status} />
            {item.time_occurred && <span className={styles.time}>{item.time_occurred}</span>}
          </div>
        </div>
      </article>
    </Link>
  )
}
