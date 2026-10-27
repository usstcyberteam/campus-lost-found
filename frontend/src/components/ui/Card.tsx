import type { HTMLAttributes, ReactNode } from 'react'
import styles from './Card.module.css'

type Variant = 'default' | 'elevated' | 'outlined'

interface Props extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant
  children: ReactNode
}

export default function Card({ variant = 'default', children, className, ...rest }: Props) {
  const classes = [styles.card, styles[variant], className || ''].filter(Boolean).join(' ')
  return <div className={classes} {...rest}>{children}</div>
}
