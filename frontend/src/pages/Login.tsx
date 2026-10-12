import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../api/client'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await login(username, password)
      navigate('/')
    } catch (e) {
      setError(errorMessage(e, '登录失败，请检查用户名或密码'))
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', padding: 24 }}>
      <h1>校园寻物局</h1>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <input
          placeholder="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          placeholder="密码"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p style={{ color: '#dc2626' }}>{error}</p>}
        <button type="submit">登录</button>
      </form>
      <p>
        还没有账号？<Link to="/register">注册</Link>
      </p>
    </div>
  )
}
