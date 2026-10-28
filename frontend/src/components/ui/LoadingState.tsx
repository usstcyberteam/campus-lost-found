import styles from './LoadingState.module.css'

export interface LoadingStateProps {
  text?: string
}

/** 加载态：放大镜在一份案卷上来回检视，文字像打字机一样带光标。 */
export default function LoadingState({ text = '正在调阅案卷…' }: LoadingStateProps) {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <div className={styles.scene} aria-hidden="true">
        <span className={styles.file}>
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className={styles.lens} />
      </div>
      <p className={styles.text}>
        {text}
        <span className={styles.caret} aria-hidden="true" />
      </p>
    </div>
  )
}
