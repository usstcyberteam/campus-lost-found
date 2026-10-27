import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import TopNav from './TopNav'
import BottomNav from './BottomNav'
import styles from './AppShell.module.css'

interface Props {
  children: ReactNode
}

export default function AppShell({ children }: Props) {
  const { role, logout } = useAuth()
  const navigate = useNavigate()

  function onLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className={styles.shell}>
      <TopNav role={role} onLogout={onLogout} />
      <main className={styles.main}>{children}</main>
      <BottomNav />
    </div>
  )
}
