import type { ReactNode } from 'react'
import styles from './Field.module.css'

interface FieldProps {
  label: string
  htmlFor?: string
  error?: string
  required?: boolean
  children: ReactNode
}

export default function Field({ label, htmlFor, error, required, children }: FieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
        {required && <span className={styles.required}> *</span>}
      </label>
      {children}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}