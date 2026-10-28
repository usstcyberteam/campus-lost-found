import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

export type EmptyArt = 'folder' | 'search' | 'tray'

export interface EmptyStateProps {
  text?: string
  action?: ReactNode
  /** 插画：空档案袋（默认）、放大镜（没搜到）、空证物托盘（还没有收获） */
  art?: EmptyArt
}

export default function EmptyState({ text = '暂无数据', action, art = 'folder' }: EmptyStateProps) {
  return (
    <div className={styles.empty} role="status">
      <img className={styles.art} src={`/brand/empty/${art}.webp`} alt="" />
      <p className={styles.text}>{text}</p>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
