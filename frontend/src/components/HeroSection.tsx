import { useNavigate } from 'react-router-dom'
import styles from './HeroSection.module.css'

interface Props {
  onPublishLost?: () => void
  onPublishFound?: () => void
}

export default function HeroSection({ onPublishLost, onPublishFound }: Props) {
  const navigate = useNavigate()

  function handleLost() {
    if (onPublishLost) onPublishLost()
    else navigate('/publish?direction=lost')
  }

  function handleFound() {
    if (onPublishFound) onPublishFound()
    else navigate('/publish?direction=found')
  }

  return (
    <section className={styles.hero}>
      <div className={styles.bgPattern} aria-hidden="true">
        <svg className={styles.waves} viewBox="0 0 800 200" preserveAspectRatio="none">
          <circle cx="120" cy="60" r="3" className={styles.node} />
          <circle cx="280" cy="100" r="3" className={styles.node} />
          <circle cx="440" cy="40" r="3" className={styles.node} />
          <circle cx="600" cy="80" r="3" className={styles.node} />
          <circle cx="720" cy="120" r="3" className={styles.node} />
          <path d="M120 60 Q200 80 280 100" className={styles.line} />
          <path d="M280 100 Q360 70 440 40" className={styles.line} />
          <path d="M440 40 Q520 60 600 80" className={styles.line} />
          <path d="M600 80 Q660 100 720 120" className={styles.line} />
        </svg>
      </div>

      <div className={styles.content}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
          </span>
          <span className={styles.brandName}>校园寻物局</span>
        </div>

        <h1 className={styles.title}>今天，有什么线索？</h1>
        <p className={styles.subtitle}>从校园的某个角落，找回属于你的东西。</p>

        <div className={styles.actions}>
          <button className={`${styles.actionCard} ${styles.lost}`} onClick={handleLost}>
            <div className={styles.actionIcon} aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
            <div className={styles.actionText}>
              <span className={styles.actionTitle}>我丢了东西</span>
              <span className={styles.actionDesc}>发布寻物信息</span>
            </div>
          </button>

          <button className={`${styles.actionCard} ${styles.found}`} onClick={handleFound}>
            <div className={styles.actionIcon} aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <div className={styles.actionText}>
              <span className={styles.actionTitle}>我捡到了东西</span>
              <span className={styles.actionDesc}>发布拾获信息</span>
            </div>
          </button>
        </div>
      </div>
    </section>
  )
}
