import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import styles from './PageHeader.module.css'

interface PageHeaderProps {
  title: string
  backTo?: string
  actions?: ReactNode
}

export default function PageHeader({ title, backTo, actions }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      {backTo ? (
        <Link className={styles.back} to={backTo} aria-label="返回">
          ←
        </Link>
      ) : (
        <span className={styles.backPlaceholder} aria-hidden="true" />
      )}
      <h1 className={styles.title}>{title}</h1>
      {actions ? <div className={styles.actions}>{actions}</div> : <span className={styles.actionsPlaceholder} />}
    </header>
  )
}