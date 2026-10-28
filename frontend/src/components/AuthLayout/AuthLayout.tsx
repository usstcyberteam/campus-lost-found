import type { ReactNode } from 'react'
import styles from './AuthLayout.module.css'

interface AuthLayoutProps {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

const POINTS = ['一句话报案', '地图圈范围', '私密核验防冒领']

/** 登录 / 注册共用外壳：手机端上方是办公桌上的卷宗照片，下方一张表单纸；桌面端左右分栏。 */
export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className={styles.screen}>
      <section className={styles.brand} aria-label="校园寻物局">
        <p className={styles.label}>
          <span className={styles.seal} aria-hidden="true">
            寻
          </span>
          <span>
            <span className={styles.labelKey}>案卷名称</span>
            校园寻物局
          </span>
        </p>
        <p className={styles.headline}>
          每一件失物，
          <br />
          都有案可查。
        </p>
        <ul className={styles.points}>
          {POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>
      <main className={styles.panel}>
        <div className={styles.card}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {children}
          {footer && <div className={styles.footer}>{footer}</div>}
        </div>
      </main>
    </div>
  )
}
