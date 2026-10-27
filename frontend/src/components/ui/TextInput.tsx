import type { InputHTMLAttributes } from 'react'
import styles from './TextInput.module.css'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string
  error?: string
  onChange?: (value: string) => void
}

export default function TextInput({ label, error, onChange, id, className, ...rest }: Props) {
  const inputId = id || (label ? `input-${label.replace(/\s+/g, '-')}` : undefined)
  const classes = [styles.wrapper, className || ''].filter(Boolean).join(' ')
  return (
    <div className={classes}>
      {label && <label htmlFor={inputId} className={styles.label}>{label}</label>}
      <input
        id={inputId}
        className={`${styles.input} ${error ? styles.errorInput : ''}`}
        onChange={(e) => onChange?.(e.target.value)}
        {...rest}
      />
      {error && <span className={styles.errorText} role="alert">{error}</span>}
    </div>
  )
}
