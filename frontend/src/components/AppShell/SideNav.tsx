import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { roleLabels } from '../../types'
import { HallIcon, MapIcon, PlusIcon, SparkIcon, UserIcon } from '../icons'
import Button from '../Button'
import styles from './SideNav.module.css'

const tabs = [
  { to: '/hall', label: '大厅', Icon: HallIcon },
  { to: '/map', label: '地图', Icon: MapIcon },
  { to: '/ai', label: 'AI 助手', Icon: SparkIcon },
  { to: '/me', label: '我的', Icon: UserIcon },
]

export default function SideNav() {
  const { role, logout } = useAuth()
  const navigate = useNavigate()

  function onLogout() {
    logout()
    navigate('/login')
  }

  return (
    <nav className={styles.nav} aria-label="侧边主导航">
      <p className={styles.brand}>校园寻物局</p>
      <NavLink
        to="/publish"
        className={({ isActive }) => (isActive ? `${styles.publish} ${styles.publishActive}` : styles.publish)}
      >
        <PlusIcon size={18} />
        发布
      </NavLink>
      <div className={styles.links}>
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
          >
            <span className={styles.icon}>
              <Icon size={20} />
            </span>
            {label}
          </NavLink>
        ))}
      </div>
      <div className={styles.footer}>
        {role && <p className={styles.role}>当前身份：{roleLabels[role]}</p>}
        <Button variant="secondary" onClick={onLogout}>
          退出登录
        </Button>
      </div>
    </nav>
  )
}