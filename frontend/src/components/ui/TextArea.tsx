import type { TextareaHTMLAttributes } from 'react'
import styles from './TextArea.module.css'

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label?: string
  error?: string
  onChange?: (value: string) => void
}

export default function TextArea({ label, error, onChange, id, className, ...rest }: Props) {
  const textareaId = id || (label ? `textarea-${label.replace(/\s+/g, '-')}` : undefined)
  const classes = [styles.wrapper, className || ''].filter(Boolean).join(' ')
  return (
    <div className={classes}>
      {label && <label htmlFor={textareaId} className={styles.label}>{label}</label>}
      <textarea
        id={textareaId}
        className={`${styles.textarea} ${error ? styles.errorTextarea : ''}`}
        onChange={(e) => onChange?.(e.target.value)}
        {...rest}
      />
      {error && <span className={styles.errorText} role="alert">{error}</span>}
    </div>
  )
}
