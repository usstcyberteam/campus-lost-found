import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, Link } from 'react-router-dom'
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  updateAnnouncement,
} from '../api/announcements'
import { errorMessage } from '../utils/error'
import { useAuth } from '../auth/AuthContext'
import type { Announcement } from '../types'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import Input from '../components/ui/Input'
import LoadingState from '../components/ui/LoadingState'
import Tag from '../components/ui/Tag'
import Field from '../components/Field'
import PageContainer from '../components/PageContainer'
import PageHeader from '../components/AppShell/PageHeader'
import styles from './AdminAnnouncements.module.css'

const PAGE_SIZE = 50

export default function AdminAnnouncements() {
  const { role } = useAuth()
  const [items, setItems] = useState<Announcement[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editPinned, setEditPinned] = useState(false)
  const seqRef = useRef(0)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [pinned, setPinned] = useState(false)
  const [formError, setFormError] = useState('')

  function load() {
    const seq = ++seqRef.current
    setLoading(true)
    setError('')
    listAnnouncements({ limit: PAGE_SIZE, offset: 0 })
      .then((page) => {
        if (seq !== seqRef.current) return
        setItems(page.items)
        setTotal(page.total)
      })
      .catch((e) => {
        if (seq === seqRef.current) setError(errorMessage(e))
      })
      .finally(() => {
        if (seq === seqRef.current) setLoading(false)
      })
  }

  useEffect(() => {
    if (role === 'admin') load()
  }, [role])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!title.trim() || !content.trim()) {
      setFormError('标题与内容都不能为空')
      return
    }
    setBusy(true)
    setFormError('')
    setMessage('')
    try {
      await createAnnouncement({ title: title.trim(), content: content.trim(), is_pinned: pinned })
      setTitle('')
      setContent('')
      setPinned(false)
      setMessage('公告已发布')
      load()
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function startEdit(item: Announcement) {
    setEditingId(item.id)
    setEditTitle(item.title)
    setEditContent(item.content)
    setEditPinned(item.is_pinned)
    setMessage('')
  }

  async function saveEdit() {
    if (!editingId) return
    setBusy(true)
    setMessage('')
    try {
      await updateAnnouncement(editingId, {
        title: editTitle.trim(),
        content: editContent.trim(),
        is_pinned: editPinned,
      })
      setEditingId(null)
      setMessage('公告已更新')
      load()
    } catch (e) {
      setMessage(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove(item: Announcement) {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      await deleteAnnouncement(item.id)
      setItems((current) => current.filter((row) => row.id !== item.id))
      setTotal((value) => Math.max(value - 1, 0))
      setMessage('公告已删除')
    } catch (e) {
      setMessage(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (role !== 'admin') return <Navigate to="/hall" replace />

  return (
    <PageContainer>
      <PageHeader title="公告管理" backTo="/me" />

      <Card className={styles.form}>
        <h2 className={styles.formTitle}>发布新公告</h2>
        <form onSubmit={submit}>
          <Field label="标题" htmlFor="ann-title" required>
            <Input
              id="ann-title"
              aria-label="公告标题"
              placeholder="例如：失物招领处开放时间调整"
              value={title}
              disabled={busy}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="内容" htmlFor="ann-content" required>
            <textarea
              id="ann-content"
              aria-label="公告内容"
              className={styles.textarea}
              placeholder="公告正文"
              maxLength={5000}
              value={content}
              disabled={busy}
              onChange={(e) => setContent(e.target.value)}
            />
          </Field>
          <label className={styles.checkbox}>
            <input type="checkbox" checked={pinned} disabled={busy} onChange={(e) => setPinned(e.target.checked)} />
            置顶显示
          </label>
          {formError && (
            <p className={styles.error} role="alert">
              {formError}
            </p>
          )}
          <Button type="submit" loading={busy}>
            发布公告
          </Button>
        </form>
      </Card>

      {message && (
        <p className={styles.status} role="status">
          {message}
        </p>
      )}
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && items.length === 0 && <EmptyState text="还没有发布过公告" />}

      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id}>
            <article className={styles.card}>
              {editingId === item.id ? (
                <div className={styles.editForm}>
                  <Field label="标题" htmlFor={`ann-edit-title-${item.id}`}>
                    <Input
                      id={`ann-edit-title-${item.id}`}
                      aria-label="编辑标题"
                      value={editTitle}
                      disabled={busy}
                      onChange={(e) => setEditTitle(e.target.value)}
                    />
                  </Field>
                  <Field label="内容" htmlFor={`ann-edit-content-${item.id}`}>
                    <textarea
                      id={`ann-edit-content-${item.id}`}
                      aria-label="编辑内容"
                      className={styles.textarea}
                      maxLength={5000}
                      value={editContent}
                      disabled={busy}
                      onChange={(e) => setEditContent(e.target.value)}
                    />
                  </Field>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={editPinned}
                      disabled={busy}
                      onChange={(e) => setEditPinned(e.target.checked)}
                    />
                    置顶显示
                  </label>
                  <div className={styles.actions}>
                    <Button loading={busy} onClick={saveEdit}>
                      保存
                    </Button>
                    <Button variant="secondary" disabled={busy} onClick={() => setEditingId(null)}>
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.head}>
                    <Link className={styles.title} to={`/announcements/${item.id}`}>
                      {item.title}
                    </Link>
                    {item.is_pinned && <Tag tone="primary">置顶</Tag>}
                    <span className={styles.meta}>{new Date(item.created_at).toLocaleString('zh-CN')}</span>
                  </div>
                  <p className={styles.content}>{item.content}</p>
                  <div className={styles.actions}>
                    <Button variant="secondary" disabled={busy} onClick={() => startEdit(item)}>
                      编辑
                    </Button>
                    <Button variant="danger" loading={busy} disabled={busy} onClick={() => remove(item)}>
                      删除
                    </Button>
                  </div>
                </>
              )}
            </article>
          </li>
        ))}
      </ul>
      <p className={styles.footNote}>共 {total} 条公告</p>
    </PageContainer>
  )
}