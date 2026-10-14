import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function Layout() {
  const { role, logout } = useAuth()
  const navigate = useNavigate()

  function onLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div>
      <nav
        style={{
          display: 'flex',
          gap: 16,
          padding: '12px 24px',
          background: '#ffffff',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <Link to="/">大厅</Link>
        <Link to="/publish">发布</Link>
        <Link to="/me">我的委托</Link>
        <Link to="/tickets">工单</Link>
        <Link to="/map">地图</Link>
        {(role === 'staff' || role === 'admin') && <Link to="/staff/claims">认领审核</Link>}
        <span style={{ marginLeft: 'auto' }}>角色：{role}</span>
        <button onClick={onLogout}>退出</button>
      </nav>
      <Outlet />
    </div>
  )
}
