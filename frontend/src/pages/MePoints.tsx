import { useState } from 'react'
import { getMyPoints, type PointReason, type PointRecord } from '../api/points'
import { useAsync } from '../hooks/useAsync'
import { errorMessage } from '../utils/error'
import { pointProgress } from '../types'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import PageContainer from '../components/PageContainer'
import PageHeader from '../components/AppShell/PageHeader'
import Tag from '../components/ui/Tag'
import styles from './MePoints.module.css'

const PAGE_SIZE = 20

const REASON_LABELS: Record<PointReason, string> = {
  thank: '协助寻物获致谢',
  return: '拾获物品完成归还',
  ticket_feedback: '工单处理反馈',
}

function reasonLabel(reason: string): string {
  return REASON_LABELS[reason as PointReason] ?? '积分变动'
}

function progressText(total: number, nextTitle: string | null, nextThreshold: number | null): string {
  if (nextThreshold == null || nextTitle == null) return '已达最高称号'
  const remaining = nextThreshold - total
  return remaining > 0 ? `再得 ${remaining} 分成为 ${nextTitle}` : `已达成 ${nextTitle}`
}

export default function MePoints() {
  const [extra, setExtra] = useState<PointRecord[]>([])
  const [busy, setBusy] = useState(false)
  const [moreError, setMoreError] = useState('')
  const state = useAsync(() => getMyPoints({ limit: PAGE_SIZE, offset: 0 }), [])

  const summary = state.data
  const records = summary ? [...summary.records.items, ...extra] : []
  const total = summary?.records.total ?? 0
  const step = summary ? Math.round(pointProgress(summary.total, summary.next_threshold) * 10) : 0

  async function loadMore() {
    if (busy || !summary) return
    setBusy(true)
    setMoreError('')
    try {
      const next = await getMyPoints({
        limit: PAGE_SIZE,
        offset: summary.records.offset + summary.records.items.length + extra.length,
      })
      const seen = new Set(records.map((record) => record.id))
      setExtra((current) => [...current, ...next.records.items.filter((record) => !seen.has(record.id))])
    } catch (e) {
      setMoreError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageContainer>
      <PageHeader title="积分明细" backTo="/me" />
      {state.loading && !summary && <LoadingState />}
      {state.error && !summary && <ErrorState message={state.error} onRetry={state.reload} />}
      {summary && (
        <>
          <Card className={styles.summary}>
            <div className={styles.headline}>
              <span className={styles.score}>{summary.total}</span>
              <span className={styles.unit}>分</span>
              <Tag tone="primary">{summary.title}</Tag>
            </div>
            {summary.next_threshold != null && (
              <div
                className={styles.progress}
                role="progressbar"
                aria-label="称号进度"
                aria-valuemin={0}
                aria-valuemax={summary.next_threshold}
                aria-valuenow={summary.total}
              >
                <div className={`${styles.bar} ${styles[`p${step}`]}`} />
              </div>
            )}
            <p className={styles.caption}>
              {progressText(summary.total, summary.next_title, summary.next_threshold)}
            </p>
          </Card>
          <h2 className={styles.sectionTitle}>积分记录</h2>
          {records.length === 0 && <EmptyState text="还没有积分记录" />}
          <ul className={styles.list}>
            {records.map((record) => (
              <li key={record.id} className={styles.row}>
                <span className={styles.reason}>{reasonLabel(record.reason)}</span>
                <span className={styles.amount}>+{record.amount} 分</span>
                <span className={styles.time}>{new Date(record.created_at).toLocaleString('zh-CN')}</span>
              </li>
            ))}
          </ul>
          {records.length < total && (
            <div className={styles.more}>
              <Button variant="secondary" loading={busy} onClick={loadMore}>
                {busy ? '加载中…' : '加载更多'}
              </Button>
            </div>
          )}
          {moreError && <ErrorState message={moreError} onRetry={loadMore} />}
        </>
      )}
    </PageContainer>
  )
}