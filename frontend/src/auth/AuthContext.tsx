import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { setToken } from '../api/token'
import { login as apiLogin, me as fetchMe, register as apiRegister } from '../api/auth'
import type { Role, StaffStatus, User } from '../types'

export interface RegisterInput {
  username: string
  password: string
  displayName: string
  role: 'student' | 'staff'
  staffNo?: string
  department?: string
}

interface AuthState {
  token: string | null
  role: Role | null
  userId: string | null
  displayName: string | null
  avatarUrl: string | null
  staffStatus: StaffStatus | null
  staffRejectReason: string | null
  ready: boolean
  login: (username: string, password: string) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  refresh: () => Promise<void>
  logout: () => void
}
const AuthContext = createContext<AuthState | null>(null)
const STORAGE_KEY = 'campus-session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokenState, setTokenState] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  function logout() {
    setToken(null)
    localStorage.removeItem(STORAGE_KEY)
    setTokenState(null)
    setUser(null)
    setReady(true)
  }

  useEffect(() => {
    let active = true
    window.addEventListener('auth-expired', logout)
    // localStorage 持久化：跨标签页与关浏览器后仍保留，避免云端预览反复要求登录
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      setToken(saved)
      fetchMe()
        .then((me) => {
          if (active) {
            setTokenState(saved)
            setUser(me)
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
      const me = await fetchMe()
      localStorage.setItem(STORAGE_KEY, token)
      setTokenState(token)
      setUser(me)
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
  async function register(input: RegisterInput) {
    const res = await apiRegister({
      username: input.username,
      password: input.password,
      display_name: input.displayName,
      role: input.role,
      staff_no: input.staffNo || null,
      department: input.department || null,
    })
    await accept(res.token)
  }
  async function refresh() {
    const me = await fetchMe()
    setUser(me)
  }
  return (
    <AuthContext.Provider
      value={{
        token: tokenState,
        role: user?.role ?? null,
        userId: user?.id ?? null,
        displayName: user?.display_name ?? null,
        avatarUrl: user?.avatar_url ?? null,
        staffStatus: user?.staff_status ?? null,
        staffRejectReason: user?.staff_reject_reason ?? null,
        ready,
        login,
        register,
        refresh,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return ctx
}
