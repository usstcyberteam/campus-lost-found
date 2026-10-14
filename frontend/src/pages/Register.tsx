import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../api/client'
import Button from '../components/Button'
import ErrorNotice from '../components/ErrorNotice'
import Field from '../components/Field'
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
    } catch (err) {
      setError(errorMessage(err, '注册失败，请重试'))
    }
  }

  return (
    <div className={styles.container}>
      <h1>注册学生账号</h1>
      <form onSubmit={onSubmit} className={styles.form}>
        <Field label="用户名">
          <input placeholder="用户名（至少 3 位）" value={username} onChange={(e) => setUsername(e.target.value)} />
        </Field>
        <Field label="昵称">
          <input placeholder="昵称" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
        <Field label="密码">
          <input
            placeholder="密码（至少 6 位）"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && <ErrorNotice message={error} />}
        <Button type="submit">注册</Button>
      </form>
      <p>
        已有账号？<Link to="/login">登录</Link>
      </p>
    </div>
  )
}
