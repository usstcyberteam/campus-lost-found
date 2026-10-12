import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

interface Props {
  children: ReactNode
}

export default function RequireAuth({ children }: Props) {
  const { token, ready } = useAuth()
  if (!ready) return <p role="status">正在验证登录状态…</p>
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}
