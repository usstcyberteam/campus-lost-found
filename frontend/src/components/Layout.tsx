import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { roleLabels } from '../types'
import Button from './Button'
import styles from './Layout.module.css'

export default function Layout() {
  const { role, logout } = useAuth()
  const navigate = useNavigate()

  function onLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div>
      <nav className={styles.nav}>
        <Link to="/">大厅</Link>
        <Link to="/publish">发布</Link>
        <Link to="/me">我的委托</Link>
        <Link to="/tickets">工单</Link>
        <Link to="/map">地图</Link>
        {(role === 'staff' || role === 'admin') && <Link to="/staff/claims">认领审核</Link>}
        {role && <span className={styles.role}>角色：{roleLabels[role]}</span>}
        <Button variant="secondary" onClick={onLogout}>
          退出
        </Button>
      </nav>
      <Outlet />
    </div>
  )
}
