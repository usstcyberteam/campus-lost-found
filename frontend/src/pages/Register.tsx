import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../utils/error'
import Button from '../components/Button'
import ErrorNotice from '../components/ErrorNotice'
import Field from '../components/Field'
import styles from './Register.module.css'

type RegisterRole = 'student' | 'staff'

const STAFF_NO_PATTERN = /^[A-Za-z0-9]{4,20}$/

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [role, setRole] = useState<RegisterRole>('student')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [staffNo, setStaffNo] = useState('')
  const [department, setDepartment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (role === 'staff' && !STAFF_NO_PATTERN.test(staffNo.trim())) {
      setError('工号需为 4~20 位字母或数字')
      return
    }
    setBusy(true)
    try {
      await register({
        username,
        password,
        displayName,
        role,
        staffNo: staffNo.trim(),
        department: department.trim(),
      })
      if (role === 'staff') setSubmitted(true)
      else navigate('/hall')
    } catch (err) {
      setError(errorMessage(err, '注册失败，请重试'))
    } finally {
      setBusy(false)
    }
  }

  if (submitted) {
    return (
      <div className={styles.container}>
        <h1>申请已提交</h1>
        <p className={styles.notice} role="status">
          教职工申请已进入待审核状态，审核通过前你仍按学生权限使用。管理员审核后重新登录即可生效。
        </p>
        <Link to="/hall">进入大厅</Link>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h1>注册账号</h1>
      <form onSubmit={onSubmit} className={styles.form}>
        <Field label="身份" htmlFor="register-role" required>
          <select
            id="register-role"
            value={role}
            disabled={busy}
            onChange={(e) => setRole(e.target.value as RegisterRole)}
          >
            <option value="student">学生</option>
            <option value="staff">教职工（需审核）</option>
          </select>
        </Field>
        <Field label="用户名" htmlFor="register-username" required>
          <input
            id="register-username"
            placeholder="用户名（至少 3 位）"
            autoComplete="username"
            value={username}
            disabled={busy}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
        <Field label="昵称" htmlFor="register-display-name" required>
          <input
            id="register-display-name"
            placeholder="昵称"
            value={displayName}
            disabled={busy}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </Field>
        <Field label="密码" htmlFor="register-password" required>
          <input
            id="register-password"
            placeholder="密码（至少 6 位）"
            type="password"
            autoComplete="new-password"
            value={password}
            disabled={busy}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {role === 'staff' && (
          <>
            <Field label="工号" htmlFor="register-staff-no" required>
              <input
                id="register-staff-no"
                placeholder="4~20 位字母或数字"
                value={staffNo}
                disabled={busy}
                onChange={(e) => setStaffNo(e.target.value)}
              />
            </Field>
            <Field label="部门" htmlFor="register-department">
              <input
                id="register-department"
                placeholder="部门（选填）"
                value={department}
                disabled={busy}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </Field>
          </>
        )}
        {error && <ErrorNotice message={error} />}
        <Button type="submit" loading={busy}>
          {role === 'staff' ? '提交申请' : '注册'}
        </Button>
      </form>
      <p>
        已有账号？<Link to="/login">登录</Link>
      </p>
    </div>
  )
}
