import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../api/client'
import Button from '../components/ui/Button'
import TextInput from '../components/ui/TextInput'
import ErrorState from '../components/ui/ErrorState'
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
      navigate('/')
    } catch (e) {
      setError(errorMessage(e, '登录失败，请检查用户名或密码'))
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.brandArea}>
        <div className={styles.brandMark} aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" fill="currentColor" />
          </svg>
        </div>
        <h1 className={styles.brandName}>校园寻物局</h1>
        <p className={styles.brandSlogan}>让每一件失物都有回家的路</p>
      </div>

      <form onSubmit={onSubmit} className={styles.form}>
        <TextInput
          label="用户名"
          placeholder="请输入用户名"
          value={username}
          onChange={setUsername}
        />
        <TextInput
          label="密码"
          type="password"
          placeholder="请输入密码"
          value={password}
          onChange={setPassword}
        />
        {error && <ErrorState message={error} />}
        <Button type="submit" variant="primary" size="lg">登录</Button>
      </form>

      <p className={styles.switchLink}>
        还没有账号？<Link to="/register">注册</Link>
      </p>
    </div>
  )
}
