import { useId, type InputHTMLAttributes } from 'react'
import styles from './Input.module.css'

type LabelProps = { label: string; 'aria-label'?: string } | { label?: never; 'aria-label': string }

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'aria-label'> &
  LabelProps & {
    error?: string
  }

export default function Input({ label, error, id, className, ...rest }: InputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const invalid = Boolean(error)
  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
          {rest.required && <span className={styles.required}> *</span>}
        </label>
      )}
      <input
        id={inputId}
        className={`${styles.control} ${invalid ? styles.invalid : ''} ${className ?? ''}`}
        aria-invalid={invalid || undefined}
        {...rest}
      />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}