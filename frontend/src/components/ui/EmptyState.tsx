import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

export interface EmptyStateProps {
  text?: string
  action?: ReactNode
}

export default function EmptyState({ text = '暂无数据', action }: EmptyStateProps) {
  return (
    <div className={styles.empty} role="status">
      <p className={styles.text}>{text}</p>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}