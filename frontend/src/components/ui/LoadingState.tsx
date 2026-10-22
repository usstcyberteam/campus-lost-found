import Spinner from '../Spinner'
import styles from './LoadingState.module.css'

export interface LoadingStateProps {
  text?: string
}

export default function LoadingState({ text = '加载中…' }: LoadingStateProps) {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <Spinner />
      <p className={styles.text}>{text}</p>
    </div>
  )
}