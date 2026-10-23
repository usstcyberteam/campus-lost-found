import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listMyNotifications } from '../api/notifications'
import { useAsync } from '../hooks/useAsync'
import { errorMessage } from '../utils/error'
import { notificationKindLabels, type NotificationItem } from '../types'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import PageContainer from '../components/PageContainer'
import PageHeader from '../components/AppShell/PageHeader'
import Tag from '../components/ui/Tag'
import styles from './Notifications.module.css'

const PAGE_SIZE = 20

function formatDate(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' })
}

function kindLabel(kind: string): string {
  return notificationKindLabels[kind] ?? '系统通知'
}

export default function Notifications() {
  const [extra, setExtra] = useState<NotificationItem[]>([])
  const [busy, setBusy] = useState(false)
  const [moreError, setMoreError] = useState('')
  const page = useAsync(() => listMyNotifications({ limit: PAGE_SIZE, offset: 0 }), [])
  const items = [...(page.data?.items ?? []), ...extra]
  const total = page.data?.total ?? 0

  async function loadMore() {
    if (busy || !page.data) return
    setBusy(true)
    setMoreError('')
    try {
      const next = await listMyNotifications({ limit: PAGE_SIZE, offset: items.length })
      const seen = new Set(items.map((row) => row.id))
      setExtra((current) => [...current, ...next.items.filter((row) => !seen.has(row.id))])
    } catch (e) {
      setMoreError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageContainer>
      <PageHeader title="我的通知" backTo="/me" />
      {page.loading && !page.data && <LoadingState />}
      {page.error && !page.data && <ErrorState message={page.error} onRetry={page.reload} />}
      {!page.loading && !page.error && page.data && items.length === 0 && (
        <EmptyState text="还没有通知，发布寻物或拾获后匹配到相似帖子会提醒你" />
      )}
      <ul className={styles.list}>
        {items.map((row) => (
          <li key={row.id} className={styles.item}>
            {row.link ? (
              <Link className={styles.row} to={row.link}>
                {renderNotice(row)}
              </Link>
            ) : (
              <div className={styles.row}>{renderNotice(row)}</div>
            )}
          </li>
        ))}
      </ul>
      {items.length < total && (
        <div className={styles.more}>
          <Button variant="secondary" loading={busy} onClick={loadMore}>
            {busy ? '加载中…' : '加载更多'}
          </Button>
        </div>
      )}
      {moreError && <ErrorState message={moreError} onRetry={loadMore} />}
    </PageContainer>
  )
}

function renderNotice(row: NotificationItem) {
  return (
    <>
      <div className={styles.rowHead}>
        <Tag tone="primary">{kindLabel(row.kind)}</Tag>
        <span className={styles.rowMeta}>{formatDate(row.created_at)}</span>
      </div>
      <p className={styles.rowText}>{row.content}</p>
    </>
  )
}