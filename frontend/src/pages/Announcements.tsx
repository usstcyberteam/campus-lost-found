import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  favoriteAnnouncement,
  listAnnouncements,
  unfavoriteAnnouncement,
} from '../api/announcements'
import { errorMessage } from '../utils/error'
import type { Announcement } from '../types'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import Tag from '../components/ui/Tag'
import PageContainer from '../components/PageContainer'
import PageHeader from '../components/AppShell/PageHeader'
import styles from './Announcements.module.css'

const PAGE_SIZE = 20

function summary(content: string): string {
  return content.length > 80 ? `${content.slice(0, 80)}…` : content
}

export default function Announcements() {
  const [items, setItems] = useState<Announcement[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const seqRef = useRef(0)

  useEffect(() => {
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
  }, [])

  async function loadMore() {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const page = await listAnnouncements({ limit: PAGE_SIZE, offset: items.length })
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

  async function toggleFavorite(item: Announcement) {
    setBusyId(item.id)
    setError('')
    try {
      const updated = item.is_favorited
        ? await unfavoriteAnnouncement(item.id)
        : await favoriteAnnouncement(item.id)
      setItems((current) => current.map((row) => (row.id === updated.id ? updated : row)))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <PageContainer>
      <PageHeader title="校园公告" backTo="/me" />
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && items.length === 0 && <EmptyState text="暂无公告" />}
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id}>
            <article className={styles.card}>
              <div className={styles.head}>
                <Link className={styles.title} to={`/announcements/${item.id}`}>
                  {item.title}
                </Link>
                {item.is_pinned && <Tag tone="primary">置顶</Tag>}
              </div>
              <p className={styles.summary}>{summary(item.content)}</p>
              <div className={styles.meta}>
                <span>
                  {item.author_name || '管理员'} · {new Date(item.created_at).toLocaleDateString('zh-CN')}
                </span>
                <Button
                  variant="secondary"
                  aria-pressed={item.is_favorited}
                  loading={busyId === item.id}
                  disabled={busyId === item.id}
                  onClick={() => toggleFavorite(item)}
                >
                  {item.is_favorited ? '已收藏' : '收藏'} · {item.favorite_count}
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