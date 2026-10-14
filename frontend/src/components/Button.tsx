import type { ButtonHTMLAttributes, ReactNode } from 'react'
import Spinner from './Spinner'
import styles from './Button.module.css'

type ButtonVariant = 'primary' | 'secondary' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
  children: ReactNode
}

export default function Button({ variant = 'primary', loading = false, disabled, children, ...rest }: ButtonProps) {
  return (
    <button
      className={`${styles.button} ${styles[variant]}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  )
}