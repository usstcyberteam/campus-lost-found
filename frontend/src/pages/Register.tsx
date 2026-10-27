import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../api/client'
import Button from '../components/ui/Button'
import TextInput from '../components/ui/TextInput'
import ErrorState from '../components/ui/ErrorState'
import styles from './Register.module.css'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await register(username, password, displayName)
      navigate('/')
    } catch (e) {
      setError(errorMessage(e, '注册失败，请重试'))
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
        <h1 className={styles.brandName}>注册学生账号</h1>
        <p className={styles.brandSlogan}>让每一件失物都有回家的路</p>
      </div>

      <form onSubmit={onSubmit} className={styles.form}>
        <TextInput
          label="用户名"
          placeholder="至少 3 位"
          value={username}
          onChange={setUsername}
        />
        <TextInput
          label="昵称"
          placeholder="请输入昵称"
          value={displayName}
          onChange={setDisplayName}
        />
        <TextInput
          label="密码"
          type="password"
          placeholder="至少 6 位"
          value={password}
          onChange={setPassword}
        />
        {error && <ErrorState message={error} />}
        <Button type="submit" variant="primary" size="lg">注册</Button>
      </form>

      <p className={styles.switchLink}>
        已有账号？<Link to="/login">登录</Link>
      </p>
    </div>
  )
}
