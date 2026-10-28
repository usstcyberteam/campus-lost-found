import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../utils/error'
import AuthLayout from '../components/AuthLayout/AuthLayout'
import Button from '../components/Button'
import ErrorNotice from '../components/ErrorNotice'
import Field from '../components/Field'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await login(username, password)
      // 跳回来源页：RequireAuth 拦截时带 from state，避免"登录→大厅→再触发登录"循环
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
      navigate(from && from !== '/login' ? from : '/hall', { replace: true })
    } catch (err) {
      setError(errorMessage(err, '登录失败，请检查用户名或密码'))
    }
  }

  return (
    <AuthLayout
      title="欢迎回来"
      subtitle="登录后调阅你的案卷、继续寻物与认领"
      footer={
        <>
          还没有账号？<Link to="/register">注册</Link>
        </>
      }
    >
      <form onSubmit={onSubmit}>
        <Field label="用户名" htmlFor="login-username">
          <input
            id="login-username"
            placeholder="请输入用户名"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
        <Field label="密码" htmlFor="login-password">
          <input
            id="login-password"
            placeholder="请输入密码"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && <ErrorNotice message={error} />}
        <Button type="submit">登录</Button>
      </form>
    </AuthLayout>
  )
}
