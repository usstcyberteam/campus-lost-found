import { NavLink } from 'react-router-dom'
import { getUnreadNotificationCount } from '../../api/notifications'
import { useAuth } from '../../auth/AuthContext'
import { useAsync } from '../../hooks/useAsync'
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
  const { token } = useAuth()
  // 未登录不拉取；登录后底部导航"我的"直接可见未读数（通知入口前置，不必先进 Me 页）
  const unread = useAsync(() => (token ? getUnreadNotificationCount() : Promise.resolve(0)), [token])
  const unreadCount = unread.data ?? 0

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
            {to === '/me' && unreadCount > 0 && (
              <span className={styles.badge} aria-label={`${unreadCount} 条未读通知`}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </span>
          <span className={styles.label}>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}