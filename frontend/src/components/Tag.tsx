import type { ReactNode } from 'react'
import styles from './Tag.module.css'

type TagTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'

interface TagProps {
  tone?: TagTone
  children: ReactNode
}

export default function Tag({ tone = 'neutral', children }: TagProps) {
  return <span className={`${styles.tag} ${styles[tone]}`}>{children}</span>
}