import { NavLink } from 'react-router-dom'
import styles from './BottomNav.module.css'

const tabs = [
  { to: '/hall', label: '大厅' },
  { to: '/map', label: '地图' },
  { to: '/ai', label: 'AI' },
  { to: '/me', label: '我的' },
]

export default function BottomNav() {
  return (
    <nav className={styles.nav} aria-label="主导航">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) => (isActive ? `${styles.tab} ${styles.active}` : styles.tab)}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}