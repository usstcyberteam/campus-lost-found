import { useEffect, useRef, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { hideComment, listModerationComments, unhideComment } from '../api/comments'
import { errorMessage } from '../utils/error'
import { useAuth } from '../auth/AuthContext'
import type { ModerationComment } from '../types'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import Tag from '../components/ui/Tag'
import PageContainer from '../components/PageContainer'
import PageHeader from '../components/AppShell/PageHeader'
import styles from './StaffComments.module.css'

const PAGE_SIZE = 20

export default function StaffComments() {
  const { role } = useAuth()
  const [onlyHidden, setOnlyHidden] = useState(false)
  const [items, setItems] = useState<ModerationComment[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const seqRef = useRef(0)

  useEffect(() => {
    if (role !== 'staff' && role !== 'admin') return
    const seq = ++seqRef.current
    setLoading(true)
    setError('')
    listModerationComments({ hidden: onlyHidden ? true : null, limit: PAGE_SIZE, offset: 0 })
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
  }, [role, onlyHidden])

  async function loadMore() {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const page = await listModerationComments({
        hidden: onlyHidden ? true : null,
        limit: PAGE_SIZE,
        offset: items.length,
      })
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

  async function toggle(row: ModerationComment) {
    setBusyId(row.id)
    setMessage('')
    try {
      if (row.is_hidden) {
        await unhideComment(row.id)
        setMessage('已恢复显示')
      } else {
        await hideComment(row.id)
        setMessage('已隐藏该评论')
      }
      setItems((current) =>
        current
          .map((item) => (item.id === row.id ? { ...item, is_hidden: !row.is_hidden } : item))
          .filter((item) => !onlyHidden || item.is_hidden),
      )
    } catch (e) {
      setMessage(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  if (role !== 'staff' && role !== 'admin') return <Navigate to="/hall" replace />

  return (
    <PageContainer>
      <PageHeader title="评论管理" backTo="/me" />
      <div className={styles.filters}>
        <Button variant={onlyHidden ? 'secondary' : 'primary'} aria-pressed={!onlyHidden} onClick={() => setOnlyHidden(false)}>
          全部评论
        </Button>
        <Button variant={onlyHidden ? 'primary' : 'secondary'} aria-pressed={onlyHidden} onClick={() => setOnlyHidden(true)}>
          仅已隐藏
        </Button>
      </div>
      {message && (
        <p className={styles.status} role="status">
          {message}
        </p>
      )}
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && items.length === 0 && <EmptyState text={onlyHidden ? '没有已隐藏的评论' : '暂无评论'} />}
      <ul className={styles.list}>
        {items.map((row) => (
          <li key={row.id}>
            <article className={styles.card}>
              <div className={styles.head}>
                <strong>{row.author_name}</strong>
                {row.is_hidden && <Tag tone="danger">已隐藏</Tag>}
                <span className={styles.meta}>{new Date(row.created_at).toLocaleString('zh-CN')}</span>
              </div>
              <p className={styles.content}>{row.content}</p>
              <div className={styles.foot}>
                <Link to={`/hall/${row.item_id}`}>{row.item_title}</Link>
                <Button
                  variant={row.is_hidden ? 'secondary' : 'danger'}
                  loading={busyId === row.id}
                  disabled={busyId === row.id}
                  onClick={() => toggle(row)}
                >
                  {row.is_hidden ? '恢复显示' : '隐藏评论'}
                </Button>
              </div>
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