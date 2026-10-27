import { Link } from 'react-router-dom'
import { type Candidate } from '../types'
import Card from './ui/Card'
import Tag from './ui/Tag'
import styles from './CandidateCard.module.css'

interface Props {
  candidate: Candidate
  lostItemId: string
}

const sourceLabels: Record<string, string> = {
  rule: '规则推荐',
  cache: '缓存',
  model: '模型',
  simulated: '模拟点位',
}

export default function CandidateCard({ candidate, lostItemId }: Props) {
  return (
    <Card variant="outlined" className={styles.card}>
      <Link to={`/items/${candidate.found_item_id}?lost=${lostItemId}`} className={styles.link}>
        <div className={styles.header}>
          <span className={styles.title}>{candidate.title}</span>
          <Tag variant="mint">拾获</Tag>
        </div>
        <div className={styles.meta}>
          <span>{candidate.category}</span>
          <span className={styles.dot}>·</span>
          <span>{candidate.location_area || '未知地点'}</span>
        </div>
        <div className={styles.explanation}>
          <span className={styles.reason}>匹配依据：{candidate.explanation}</span>
          <Tag variant="secondary">{sourceLabels[candidate.source] || candidate.source}</Tag>
        </div>
      </Link>
    </Card>
  )
}
