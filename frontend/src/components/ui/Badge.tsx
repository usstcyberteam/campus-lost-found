import type { ReactNode } from 'react'
import styles from './Badge.module.css'

type Variant = 'primary' | 'secondary' | 'coral' | 'mint' | 'gray' | 'danger'

interface Props {
  variant?: Variant
  children: ReactNode
}

export default function Badge({ variant = 'primary', children }: Props) {
  return <span className={`${styles.badge} ${styles[variant]}`}>{children}</span>
}
