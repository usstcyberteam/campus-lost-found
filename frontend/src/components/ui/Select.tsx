import { useId, type SelectHTMLAttributes } from 'react'
import styles from './Select.module.css'

type LabelProps = { label: string; 'aria-label'?: string } | { label?: never; 'aria-label': string }

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'aria-label'> &
  LabelProps & {
    error?: string
  }

export default function Select({ label, error, id, className, children, ...rest }: SelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  const invalid = Boolean(error)
  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label} htmlFor={selectId}>
          {label}
          {rest.required && <span className={styles.required}> *</span>}
        </label>
      )}
      <select
        id={selectId}
        className={`${styles.control} ${invalid ? styles.invalid : ''} ${className ?? ''}`}
        aria-invalid={invalid || undefined}
        {...rest}
      >
        {children}
      </select>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}