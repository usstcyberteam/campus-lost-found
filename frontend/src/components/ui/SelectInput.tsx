import type { SelectHTMLAttributes } from 'react'
import styles from './SelectInput.module.css'

interface Option {
  value: string
  label: string
}

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string
  error?: string
  options: Option[]
  onChange?: (value: string) => void
}

export default function SelectInput({ label, error, options, onChange, id, className, ...rest }: Props) {
  const selectId = id || (label ? `select-${label.replace(/\s+/g, '-')}` : undefined)
  const classes = [styles.wrapper, className || ''].filter(Boolean).join(' ')
  return (
    <div className={classes}>
      {label && <label htmlFor={selectId} className={styles.label}>{label}</label>}
      <select
        id={selectId}
        className={`${styles.select} ${error ? styles.errorSelect : ''}`}
        onChange={(e) => onChange?.(e.target.value)}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <span className={styles.errorText} role="alert">{error}</span>}
    </div>
  )
}
