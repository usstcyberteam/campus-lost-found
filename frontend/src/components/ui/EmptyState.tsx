import type { ReactNode } from 'react'
import Button from './Button'
import styles from './EmptyState.module.css'

interface Props {
  icon?: ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({ icon, title, description, actionLabel, onAction }: Props) {
  return (
    <div className={styles.container}>
      {icon && <div className={styles.icon}>{icon}</div>}
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {actionLabel && onAction && <Button variant="secondary" size="sm" onClick={onAction}>{actionLabel}</Button>}
    </div>
  )
}
