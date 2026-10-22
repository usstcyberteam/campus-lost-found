import { NavLink } from 'react-router-dom'
import { HallIcon, MapIcon, PlusIcon, SparkIcon, UserIcon } from '../icons'
import styles from './BottomNav.module.css'

const leftTabs = [
  { to: '/hall', label: '大厅', Icon: HallIcon },
  { to: '/map', label: '地图', Icon: MapIcon },
]

const rightTabs = [
  { to: '/ai', label: 'AI', Icon: SparkIcon },
  { to: '/me', label: '我的', Icon: UserIcon },
]

function tabClass({ isActive }: { isActive: boolean }) {
  return isActive ? `${styles.tab} ${styles.active}` : styles.tab
}

export default function BottomNav() {
  return (
    <nav className={styles.nav} aria-label="主导航">
      {leftTabs.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} className={tabClass}>
          <span className={styles.icon}>
            <Icon />
          </span>
          <span className={styles.label}>{label}</span>
        </NavLink>
      ))}
      <NavLink
        to="/publish"
        aria-label="发布内容"
        className={({ isActive }) => (isActive ? `${styles.fab} ${styles.fabActive}` : styles.fab)}
      >
        <span className={styles.fabCircle}>
          <PlusIcon size={26} />
        </span>
        <span className={styles.fabLabel}>发布</span>
      </NavLink>
      {rightTabs.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} className={tabClass}>
          <span className={styles.icon}>
            <Icon />
          </span>
          <span className={styles.label}>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}