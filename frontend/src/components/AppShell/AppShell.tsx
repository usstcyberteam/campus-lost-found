import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'
import SideNav from './SideNav'
import styles from './AppShell.module.css'

export default function AppShell() {
  return (
    <div className={styles.shell}>
      <SideNav />
      <div className={styles.main}>
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}