import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import client, { setToken } from '../api/client'

export type Role = 'student' | 'staff' | 'admin'
interface AuthState {
  token: string | null
  role: Role | null
  userId: string | null
  ready: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string, displayName: string) => Promise<void>
  logout: () => void
}
const AuthContext = createContext<AuthState | null>(null)
const STORAGE_KEY = 'campus-session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokenState, setTokenState] = useState<string | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  function logout() {
    setToken(null)
    sessionStorage.removeItem(STORAGE_KEY)
    setTokenState(null)
    setRole(null)
    setUserId(null)
    setReady(true)
  }

  useEffect(() => {
    let active = true
    window.addEventListener('auth-expired', logout)
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (saved) {
      setToken(saved)
      client
        .get('/auth/me')
        .then((r) => {
          if (active) {
            setTokenState(saved)
            setRole(r.data.role)
            setUserId(r.data.id)
          }
        })
        .catch(() => {
          if (active) logout()
        })
        .finally(() => {
          if (active) setReady(true)
        })
    } else setReady(true)
    return () => {
      active = false
      window.removeEventListener('auth-expired', logout)
    }
  }, [])

  async function accept(token: string) {
    setToken(token)
    try {
      const r = await client.get('/auth/me')
      sessionStorage.setItem(STORAGE_KEY, token)
      setTokenState(token)
      setRole(r.data.role)
      setUserId(r.data.id)
      setReady(true)
    } catch (e) {
      logout()
      throw e
    }
  }
  async function login(username: string, password: string) {
    const res = await client.post('/auth/login', { username, password })
    await accept(res.data.token)
  }
  async function register(username: string, password: string, displayName: string) {
    const res = await client.post('/auth/register', { username, password, display_name: displayName })
    await accept(res.data.token)
  }
  return (
    <AuthContext.Provider value={{ token: tokenState, role, userId, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return ctx
}
