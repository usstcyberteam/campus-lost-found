import styles from './Spinner.module.css'

interface SpinnerProps {
  size?: 'sm' | 'md'
}

export default function Spinner({ size = 'md' }: SpinnerProps) {
  return <span className={`${styles.spinner} ${styles[size]}`} role="status" aria-label="加载中" />
}