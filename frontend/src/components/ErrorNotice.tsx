import styles from './ErrorNotice.module.css'

interface ErrorNoticeProps {
  message: string
}

export default function ErrorNotice({ message }: ErrorNoticeProps) {
  return (
    <div className={styles.notice} role="alert">
      {message}
    </div>
  )
}