import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createPraise, deletePraise, listPraises, lookupUser, updatePraise } from '../api/praises'
import { listMyItems } from '../api/me'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../utils/error'
import { placeLabel, type Item, type Praise } from '../types'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import Input from '../components/ui/Input'
import LoadingState from '../components/ui/LoadingState'
import Field from '../components/Field'
import PageContainer from '../components/PageContainer'
import PageHeader from '../components/AppShell/PageHeader'
import styles from './Praises.module.css'

const PAGE_SIZE = 20

export default function Praises() {
  const { userId } = useAuth()
  const [items, setItems] = useState<Praise[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const seqRef = useRef(0)

  const [username, setUsername] = useState('')
  const [target, setTarget] = useState<{ id: string; display_name: string } | null>(null)
  const [content, setContent] = useState('')
  const [itemId, setItemId] = useState('')
  const [myItems, setMyItems] = useState<Item[]>([])
  const [formError, setFormError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  function load() {
    const seq = ++seqRef.current
    setLoading(true)
    setError('')
    listPraises({ limit: PAGE_SIZE, offset: 0 })
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
    load()
    listMyItems({ limit: 100 })
      .then((page) => setMyItems(page.items))
      .catch(() => {})
  }, [])

  async function loadMore() {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const page = await listPraises({ limit: PAGE_SIZE, offset: items.length })
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id))
        return [...current, ...page.items.filter((item) => !seen.has(item.id))]
      })
      setTotal(page.total)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoadingMore(false)
    }
  }

  async function resolveUser() {
    if (!username.trim()) {
      setFormError('请填写被表扬人的用户名')
      return
    }
    setFormError('')
    setTarget(null)
    try {
      const found = await lookupUser(username.trim())
      setTarget(found)
    } catch (e) {
      setFormError(errorMessage(e, '没有找到该用户'))
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!target) {
      setFormError('请先查找并确认被表扬人')
      return
    }
    if (!content.trim()) {
      setFormError('请填写表扬内容')
      return
    }
    setBusy(true)
    setFormError('')
    setMessage('')
    try {
      await createPraise({ to_user_id: target.id, content: content.trim(), item_id: itemId || null })
      setUsername('')
      setTarget(null)
      setContent('')
      setItemId('')
      setMessage('表扬已发布')
      load()
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit() {
    if (!editingId) return
    setBusy(true)
    setMessage('')
    try {
      await updatePraise(editingId, { content: editContent.trim() })
      setEditingId(null)
      setMessage('已更新表扬')
      load()
    } catch (e) {
      setMessage(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove(row: Praise) {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      await deletePraise(row.id)
      setItems((current) => current.filter((item) => item.id !== row.id))
      setTotal((value) => Math.max(value - 1, 0))
      setMessage('已删除表扬')
    } catch (e) {
      setMessage(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageContainer>
      <PageHeader title="表扬墙" backTo="/me" />

      <Card className={styles.form}>
        <h2 className={styles.formTitle}>写一条表扬</h2>
        <form onSubmit={submit}>
          <Field label="被表扬人用户名" htmlFor="praise-username" required>
            <div className={styles.lookupRow}>
              <Input
                id="praise-username"
                aria-label="被表扬人用户名"
                placeholder="对方注册的用户名"
                value={username}
                disabled={busy}
                onChange={(e) => {
                  setUsername(e.target.value)
                  setTarget(null)
                }}
              />
              <Button type="button" variant="secondary" disabled={busy} onClick={resolveUser}>
                查找
              </Button>
            </div>
          </Field>
          {target && <p className={styles.resolved}>已确认：{target.display_name}</p>}
          <Field label="关联记录（选填）" htmlFor="praise-item">
            <select
              id="praise-item"
              aria-label="关联记录"
              value={itemId}
              disabled={busy}
              onChange={(e) => setItemId(e.target.value)}
            >
              <option value="">不关联</option>
              {myItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} · {placeLabel(item)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="表扬内容" htmlFor="praise-content" required>
            <textarea
              id="praise-content"
              aria-label="表扬内容"
              className={styles.textarea}
              placeholder="例如：帮我找回钱包，还特意送到宿舍，非常感谢！"
              maxLength={500}
              value={content}
              disabled={busy}
              onChange={(e) => setContent(e.target.value)}
            />
          </Field>
          {formError && (
            <p className={styles.error} role="alert">
              {formError}
            </p>
          )}
          <Button type="submit" loading={busy}>
            发布表扬
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
      {!loading && !error && items.length === 0 && <EmptyState text="还没有表扬，做第一个表扬别人的人吧" />}

      <ul className={styles.list}>
        {items.map((row) => (
          <li key={row.id}>
            <article className={styles.card}>
              <div className={styles.head}>
                <span className={styles.thanks}>
                  <strong>{row.from_name}</strong> 致谢 <strong>{row.to_name}</strong>
                </span>
                <span className={styles.meta}>{new Date(row.created_at).toLocaleString('zh-CN')}</span>
              </div>
              {editingId === row.id ? (
                <div className={styles.editForm}>
                  <textarea
                    aria-label="编辑表扬内容"
                    className={styles.textarea}
                    maxLength={500}
                    value={editContent}
                    disabled={busy}
                    onChange={(e) => setEditContent(e.target.value)}
                  />
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
                  <p className={styles.content}>{row.content}</p>
                  {row.item_id && (
                    <p className={styles.related}>
                      关联记录：
                      <Link to={`/hall/${row.item_id}`}>{row.item_title || '查看记录'}</Link>
                    </p>
                  )}
                  {(row.can_edit || row.from_user_id === userId) && (
                    <div className={styles.actions}>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(row.id)
                          setEditContent(row.content)
                        }}
                      >
                        编辑
                      </Button>
                      <Button variant="danger" loading={busy} disabled={busy} onClick={() => remove(row)}>
                        删除
                      </Button>
                    </div>
                  )}
                </>
              )}
            </article>
          </li>
        ))}
      </ul>
      {!loading && items.length < total && (
        <div className={styles.more}>
          <Button variant="secondary" loading={loadingMore} disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? '加载中…' : '加载更多'}
          </Button>
        </div>
      )}
    </PageContainer>
  )
}