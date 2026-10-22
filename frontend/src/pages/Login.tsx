import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../utils/error'
import BlobStudio from '../components/BlobStudio/BlobStudio'
import Button from '../components/Button'
import ErrorNotice from '../components/ErrorNotice'
import Field from '../components/Field'
import styles from './Login.module.css'

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
      navigate('/hall')
    } catch (err) {
      setError(errorMessage(err, '登录失败，请检查用户名或密码'))
    }
  }

  return (
    <>
      {/* 装饰性背景：pointer-events: none，不影响表单的任何操作 */}
      <BlobStudio variant="backdrop" />
      <div className={styles.container}>
        <h1>校园寻物局</h1>
        <form onSubmit={onSubmit} className={styles.form}>
          <Field label="用户名">
            <input placeholder="用户名" value={username} onChange={(e) => setUsername(e.target.value)} />
          </Field>
          <Field label="密码">
            <input
              placeholder="密码"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <ErrorNotice message={error} />}
          <Button type="submit">登录</Button>
        </form>
        <p>
          还没有账号？<Link to="/register">注册</Link>
        </p>
      </div>
    </>
  )
}