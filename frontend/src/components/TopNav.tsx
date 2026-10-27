import { NavLink, useNavigate } from 'react-router-dom'
import { type Role } from '../auth/AuthContext'
import Button from './ui/Button'
import styles from './TopNav.module.css'

interface Props {
  role: Role | null
  onLogout: () => void
}

export default function TopNav({ role, onLogout }: Props) {
  const navigate = useNavigate()

  const links = [
    { to: '/', label: '大厅' },
    { to: '/publish', label: '发布' },
    { to: '/map', label: '地图' },
    { to: '/me', label: '我的委托' },
    { to: '/tickets', label: '工单' },
  ]

  return (
    <nav className={styles.nav} aria-label="主导航">
      <div className={styles.brand} onClick={() => navigate('/')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
        <span className={styles.brandName}>校园寻物局</span>
      </div>

      <div className={styles.links}>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `${styles.link} ${isActive ? styles.linkActive : ''}`}
            end={link.to === '/'}
          >
            {link.label}
          </NavLink>
        ))}
        {role === 'staff' && (
          <NavLink
            to="/staff/claims"
            className={({ isActive }) => `${styles.link} ${isActive ? styles.linkActive : ''}`}
          >
            认领审核
          </NavLink>
        )}
      </div>

      <div className={styles.right}>
        <span className={styles.role}>{role === 'student' ? '学生' : role === 'staff' ? '工作人员' : role === 'admin' ? '管理员' : ''}</span>
        <Button variant="ghost" size="sm" onClick={onLogout}>退出</Button>
      </div>
    </nav>
  )
}
