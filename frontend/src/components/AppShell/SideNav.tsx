import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { roleLabels } from '../../types'
import Button from '../Button'
import styles from './SideNav.module.css'

const tabs = [
  { to: '/hall', label: '大厅' },
  { to: '/map', label: '地图' },
  { to: '/ai', label: 'AI 助手' },
  { to: '/me', label: '我的' },
]

export default function SideNav() {
  const { role, logout } = useAuth()
  const navigate = useNavigate()

  function onLogout() {
    logout()
    navigate('/login')
  }

  return (
    <nav className={styles.nav} aria-label="主导航">
      <p className={styles.brand}>校园寻物局</p>
      <div className={styles.links}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
          >
            {tab.label}
          </NavLink>
        ))}
        <NavLink
          to="/publish"
          className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
        >
          发布
        </NavLink>
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