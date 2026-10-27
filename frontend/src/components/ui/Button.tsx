import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
}

export default function Button({ variant = 'primary', size = 'md', loading = false, children, className, disabled, ...rest }: Props) {
  const classes = [styles.btn, styles[variant], styles[size], loading ? styles.loading : '', className || ''].filter(Boolean).join(' ')
  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      <span className={styles.label}>{children}</span>
    </button>
  )
}
