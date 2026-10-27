import styles from './LoadingIndicator.module.css'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

export default function LoadingIndicator({ size = 'md', label }: Props) {
  return (
    <div className={styles.container}>
      <span className={`${styles.spinner} ${styles[size]}`} aria-hidden="true" />
      {label && <span className={styles.label}>{label}</span>}
    </div>
  )
}
