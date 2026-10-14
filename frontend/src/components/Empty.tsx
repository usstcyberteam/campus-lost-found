import styles from './Empty.module.css'

interface EmptyProps {
  text?: string
}

export default function Empty({ text = '暂无数据' }: EmptyProps) {
  return (
    <div className={styles.empty} role="status">
      {text}
    </div>
  )
}