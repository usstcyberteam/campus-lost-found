import type { ReactNode } from 'react'
import styles from './Tag.module.css'

type Variant = 'coral' | 'mint' | 'primary' | 'secondary' | 'gray'

interface Props {
  variant?: Variant
  children: ReactNode
}

export default function Tag({ variant = 'primary', children }: Props) {
  return <span className={`${styles.tag} ${styles[variant]}`}>{children}</span>
}
