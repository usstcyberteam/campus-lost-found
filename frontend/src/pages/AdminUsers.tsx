import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { listUsers, updateUser } from '../api/admin'
import { useDebounce } from '../hooks/useDebounce'
import { errorMessage } from '../utils/error'
import { useAuth } from '../auth/AuthContext'
import { roleLabels, staffStatusLabels, type AdminUser, type Role } from '../types'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import Input from '../components/ui/Input'
import LoadingState from '../components/ui/LoadingState'
import Select from '../components/ui/Select'
import Tag from '../components/ui/Tag'
import Field from '../components/Field'
import PageContainer from '../components/PageContainer'
import PageHeader from '../components/AppShell/PageHeader'
import styles from './AdminUsers.module.css'

const PAGE_SIZE = 20

export default function AdminUsers() {
  const { role } = useAuth()
  const [q, setQ] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | ''>('')
  const debouncedQ = useDebounce(q, 300)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const seqRef = useRef(0)

  useEffect(() => {
    if (role !== 'admin') return
    const seq = ++seqRef.current
    setLoading(true)
    setError('')
    listUsers({ q: debouncedQ || undefined, role: roleFilter || null, limit: PAGE_SIZE, offset: 0 })
      .then((page) => {
        if (seq !== seqRef.current) return
        setUsers(page.items)
        setTotal(page.total)
      })
      .catch((e) => {
        if (seq === seqRef.current) setError(errorMessage(e))
      })
      .finally(() => {
        if (seq === seqRef.current) setLoading(false)
      })
  }, [role, debouncedQ, roleFilter])

  async function loadMore() {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const page = await listUsers({
        q: debouncedQ || undefined,
        role: roleFilter || null,
        limit: PAGE_SIZE,
        offset: users.length,
      })
      setUsers((current) => {
        const seen = new Set(current.map((u) => u.id))
        return [...current, ...page.items.filter((u) => !seen.has(u.id))]
      })
      setTotal(page.total)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoadingMore(false)
    }
  }

  async function apply(user: AdminUser, body: { role?: Role; is_banned?: boolean }) {
    setBusyId(user.id)
    setMessage('')
    try {
      const updated = await updateUser(user.id, body)
      setUsers((current) => current.map((u) => (u.id === updated.id ? updated : u)))
      setMessage(`已更新「${updated.display_name}」`)
    } catch (e) {
      setMessage(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  if (role !== 'admin') return <Navigate to="/hall" replace />

  return (
    <PageContainer>
      <PageHeader title="用户管理" backTo="/me" />
      <div className={styles.filters}>
        <Input
          aria-label="搜索用户"
          placeholder="搜索用户名或昵称"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select
          aria-label="角色筛选"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | '')}
        >
          <option value="">全部角色</option>
          <option value="student">学生</option>
          <option value="staff">工作人员</option>
          <option value="admin">管理员</option>
        </Select>
      </div>
      {message && (
        <p className={styles.status} role="status">
          {message}
        </p>
      )}
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && users.length === 0 && <EmptyState text="没有匹配的用户" />}
      <ul className={styles.list}>
        {users.map((user) => {
          const editable = user.role !== 'admin'
          return (
            <li key={user.id}>
              <Card className={styles.card}>
                <div className={styles.head}>
                  <h2 className={styles.name}>{user.display_name}</h2>
                  <Tag tone={user.role === 'admin' ? 'primary' : 'neutral'}>{roleLabels[user.role]}</Tag>
                  {user.staff_status !== 'none' && (
                    <Tag tone={user.staff_status === 'approved' ? 'success' : 'warning'}>
                      {staffStatusLabels[user.staff_status]}
                    </Tag>
                  )}
                  {user.is_banned && <Tag tone="danger">已封禁</Tag>}
                </div>
                <p className={styles.meta}>
                  用户名：{user.username} · 注册于 {new Date(user.created_at).toLocaleDateString('zh-CN')}
                </p>
                <div className={styles.actions}>
                  <Field label="角色" htmlFor={`role-${user.id}`}>
                    <Select
                      id={`role-${user.id}`}
                      aria-label={`角色 ${user.username}`}
                      value={user.role}
                      disabled={!editable || busyId === user.id}
                      onChange={(e) => apply(user, { role: e.target.value as Role })}
                    >
                      <option value="student">学生</option>
                      <option value="staff">工作人员</option>
                      {user.role === 'admin' && <option value="admin">管理员</option>}
                    </Select>
                  </Field>
                  {editable && (
                    <Button
                      variant={user.is_banned ? 'secondary' : 'danger'}
                      loading={busyId === user.id}
                      disabled={busyId === user.id}
                      onClick={() => apply(user, { is_banned: !user.is_banned })}
                    >
                      {user.is_banned ? '解除封禁' : '封禁账号'}
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          )
        })}
      </ul>
      {!loading && users.length < total && (
        <div className={styles.more}>
          <Button variant="secondary" loading={loadingMore} disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? '加载中…' : '加载更多'}
          </Button>
        </div>
      )}
      <p className={styles.hint}>管理员账号不可在此修改；封禁后该用户无法登录，已登录的会话立即失效。</p>
    </PageContainer>
  )
}