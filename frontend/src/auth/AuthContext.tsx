import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { setToken } from '../api/token'
import { login as apiLogin, me as fetchMe, register as apiRegister } from '../api/auth'
import type { Role } from '../types'

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
      fetchMe()
        .then((user) => {
          if (active) {
            setTokenState(saved)
            setRole(user.role)
            setUserId(user.id)
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
      const user = await fetchMe()
      sessionStorage.setItem(STORAGE_KEY, token)
      setTokenState(token)
      setRole(user.role)
      setUserId(user.id)
      setReady(true)
    } catch (e) {
      logout()
      throw e
    }
  }
  async function login(username: string, password: string) {
    const res = await apiLogin({ username, password })
    await accept(res.token)
  }
  async function register(username: string, password: string, displayName: string) {
    const res = await apiRegister({ username, password, display_name: displayName })
    await accept(res.token)
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
