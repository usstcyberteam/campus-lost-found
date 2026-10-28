import type { ReactNode } from 'react'
import styles from './Tag.module.css'

export type TagTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'lost' | 'found'

export interface TagProps {
  tone?: TagTone
  children: ReactNode
}

export default function Tag({ tone = 'neutral', children }: TagProps) {
  return <span className={`${styles.tag} ${styles[tone]}`}>{children}</span>
}
