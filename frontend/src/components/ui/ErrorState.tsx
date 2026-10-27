import Button from './Button'
import styles from './ErrorState.module.css'

interface Props {
  message: string
  onRetry?: () => void
}

export default function ErrorState({ message, onRetry }: Props) {
  return (
    <div className={styles.container} role="alert">
      <div className={styles.icon} aria-hidden="true">!</div>
      <p className={styles.message}>{message}</p>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>重试</Button>}
    </div>
  )
}
