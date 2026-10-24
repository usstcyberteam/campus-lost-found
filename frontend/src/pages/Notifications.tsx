import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMyNotifications, markNotificationRead } from '../api/notifications'
import { useAsync } from '../hooks/useAsync'
import { useTTS } from '../hooks/useTTS'
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
  // 已读覆盖表：点击通知后乐观置 true，避免整页重拉
  const [readOverrides, setReadOverrides] = useState<Record<string, boolean>>({})
  // 语音播报：同一时间只播一条，speakingId 标记当前朗读的通知行
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const tts = useTTS()
  const page = useAsync(() => listMyNotifications({ limit: PAGE_SIZE, offset: 0 }), [])
  const items = [...(page.data?.items ?? []), ...extra]
  const total = page.data?.total ?? 0

  // 播报结束（tts.speaking 回落）时清行标记，按钮恢复 🔊
  useEffect(() => {
    if (!tts.speaking) setSpeakingId(null)
  }, [tts.speaking])

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

  function onNoticeClick(row: NotificationItem) {
    if (row.read || readOverrides[row.id]) return
    setReadOverrides((current) => ({ ...current, [row.id]: true }))
    // 标记失败静默：下次进页面仍是未读，无损
    markNotificationRead(row.id).catch(() => {})
  }

  function onSpeak(row: NotificationItem) {
    if (speakingId === row.id && tts.speaking) {
      tts.stop()
      setSpeakingId(null)
      return
    }
    setSpeakingId(row.id)
    tts.speak(row.content)
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
        {items.map((row) => {
          const read = row.read || readOverrides[row.id]
          const speakingThis = tts.speaking && speakingId === row.id
          return (
            <li key={row.id} className={styles.item}>
              <div className={styles.rowWrap}>
                {row.link ? (
                  <Link
                    className={`${styles.row} ${read ? '' : styles.unread}`}
                    to={row.link}
                    onClick={() => onNoticeClick(row)}
                  >
                    {renderNotice(row, read)}
                  </Link>
                ) : (
                  <div className={`${styles.row} ${read ? '' : styles.unread}`}>{renderNotice(row, read)}</div>
                )}
                {tts.isSupported && (
                  <button
                    type="button"
                    className={styles.speak}
                    onClick={() => onSpeak(row)}
                    aria-label={speakingThis ? '停止朗读这条通知' : '朗读这条通知'}
                    aria-pressed={speakingThis}
                  >
                    {speakingThis ? '🔇' : '🔊'}
                  </button>
                )}
              </div>
            </li>
          )
        })}
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

function renderNotice(row: NotificationItem, read: boolean) {
  return (
    <>
      <div className={styles.rowHead}>
        <Tag tone={read ? 'neutral' : 'primary'}>{kindLabel(row.kind)}</Tag>
        <span className={styles.rowMeta}>
          {read ? '' : '未读 · '}
          {formatDate(row.created_at)}
        </span>
      </div>
      <p className={styles.rowText}>{row.content}</p>
    </>
  )
}