import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

interface Props {
  children: ReactNode
}

export default function RequireAuth({ children }: Props) {
  const { token, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <p role="status">正在验证登录状态…</p>
  if (!token) {
    // 带 from state：登录成功后跳回本页，避免"登录→大厅→再触发登录"循环
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <>{children}</>
}
