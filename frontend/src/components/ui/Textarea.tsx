import { useId, type TextareaHTMLAttributes } from 'react'
import styles from './Textarea.module.css'

type LabelProps = { label: string; 'aria-label'?: string } | { label?: never; 'aria-label': string }

export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'aria-label'> &
  LabelProps & {
    error?: string
  }

export default function Textarea({ label, error, id, className, ...rest }: TextareaProps) {
  const autoId = useId()
  const textareaId = id ?? autoId
  const invalid = Boolean(error)
  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label} htmlFor={textareaId}>
          {label}
          {rest.required && <span className={styles.required}> *</span>}
        </label>
      )}
      <textarea
        id={textareaId}
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