import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  listMyClaims,
  listMyComments,
  listMyFavorites,
  listMyHelping,
  listMyItems,
  listMyLikes,
  listMyTickets,
} from '../api/me'
import { useAsync } from '../hooks/useAsync'
import { errorMessage } from '../utils/error'
import {
  claimStatusLabels,
  helperStatusLabels,
  ticketStatusLabels,
  type ClaimStatus,
  type HelpingItem,
  type Item,
  type ItemStatus,
  type MyClaim,
  type MyComment,
  type Page,
  type Ticket,
  type TicketStatus,
} from '../types'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import ItemCard from '../components/ItemCard/ItemCard'
import LoadingState from '../components/ui/LoadingState'
import PageContainer from '../components/PageContainer'
import PageHeader from '../components/AppShell/PageHeader'
import Tag, { type TagTone } from '../components/ui/Tag'
import styles from './MeList.module.css'

const PAGE_SIZE = 20

type Row = Item | MyClaim | MyComment | Ticket

interface KindConfig {
  title: string
  empty: string
  load: (offset: number) => Promise<Page<Row>>
}

const CLAIM_TONES: Record<ClaimStatus, TagTone> = {
  pending: 'warning',
  approved: 'primary',
  completed: 'success',
  rejected: 'danger',
}

const TICKET_TONES: Record<TicketStatus, TagTone> = {
  pending: 'warning',
  processing: 'primary',
  feedback: 'success',
}

const ONGOING_STATUS: ReadonlySet<ItemStatus> = new Set(['searching', 'reviewing'])
const THANKED_LABEL = '已被致谢'

interface HelperBadge {
  label: string
  tone: TagTone
  showThankedTag: boolean
}

function helperBadge(item: HelpingItem): HelperBadge {
  if (item.helper_status === 'abandoned') {
    return { label: helperStatusLabels.abandoned, tone: 'neutral', showThankedTag: item.thanked }
  }
  if (ONGOING_STATUS.has(item.status)) {
    return { label: helperStatusLabels.active, tone: 'primary', showThankedTag: item.thanked }
  }
  if (item.thanked) return { label: THANKED_LABEL, tone: 'success', showThankedTag: false }
  return { label: '已结束', tone: 'neutral', showThankedTag: false }
}

const KIND_CONFIG: Record<string, KindConfig> = {
  posts: {
    title: '我的发布',
    empty: '还没有发布过寻物或拾获',
    load: (offset) => listMyItems({ limit: PAGE_SIZE, offset }),
  },
  favorites: {
    title: '我的收藏',
    empty: '还没有收藏任何记录',
    load: (offset) => listMyFavorites({ limit: PAGE_SIZE, offset }),
  },
  likes: {
    title: '我点赞的',
    empty: '还没有点赞任何记录',
    load: (offset) => listMyLikes({ limit: PAGE_SIZE, offset }),
  },
  helping: {
    title: '我接取的',
    empty: '还没有接取过委托',
    load: (offset) => listMyHelping({ limit: PAGE_SIZE, offset }),
  },
  claims: {
    title: '我的认领',
    empty: '还没有提交过认领申请',
    load: (offset) => listMyClaims({ limit: PAGE_SIZE, offset }),
  },
  comments: {
    title: '我的评论',
    empty: '还没有发表过评论',
    load: (offset) => listMyComments({ limit: PAGE_SIZE, offset }),
  },
  tickets: {
    title: '我的工单',
    empty: '还没有提交过协助工单',
    load: (offset) => listMyTickets({ limit: PAGE_SIZE, offset }),
  },
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('zh-CN')
}

function summary(content: string): string {
  return content.length > 60 ? `${content.slice(0, 60)}…` : content
}

function renderRow(kind: string, row: Row) {
  if (kind === 'helping') {
    const item = row as HelpingItem
    const badge = helperBadge(item)
    return (
      <ItemCard
        item={item}
        extra={
          <>
            <Tag tone={badge.tone}>{badge.label}</Tag>
            {badge.showThankedTag && <Tag tone="success">{THANKED_LABEL}</Tag>}
            <span>接取于 {formatDate(item.taken_at)}</span>
          </>
        }
      />
    )
  }
  if (kind === 'claims') {
    const claim = row as MyClaim
    return (
      <Link className={styles.row} to={`/hall/${claim.found_item_id}`}>
        <div className={styles.rowHead}>
          <span className={styles.rowTitle}>{claim.item_title}</span>
          <Tag tone={CLAIM_TONES[claim.status]}>{claimStatusLabels[claim.status]}</Tag>
        </div>
        <span className={styles.rowMeta}>申请于 {formatDate(claim.created_at)}</span>
      </Link>
    )
  }
  if (kind === 'comments') {
    const comment = row as MyComment
    return (
      <Link className={styles.row} to={`/hall/${comment.item_id}`}>
        <div className={styles.rowHead}>
          <span className={styles.rowTitle}>{summary(comment.content)}</span>
        </div>
        <span className={styles.rowMeta}>
          {comment.item_title} · {formatDate(comment.created_at)}
        </span>
      </Link>
    )
  }
  if (kind === 'tickets') {
    const ticket = row as Ticket
    return (
      <div className={styles.row}>
        <div className={styles.rowHead}>
          <Tag tone={TICKET_TONES[ticket.status]}>{ticketStatusLabels[ticket.status]}</Tag>
          <span className={styles.rowMeta}>{formatDate(ticket.created_at)}</span>
        </div>
        <span className={styles.rowText}>{ticket.result || '等待处理结果'}</span>
      </div>
    )
  }
  return <ItemCard item={row as Item} />
}

export default function MeList() {
  const { kind = '' } = useParams()
  const config = KIND_CONFIG[kind]
  const [extra, setExtra] = useState<Row[]>([])
  const [moreError, setMoreError] = useState('')
  const [busy, setBusy] = useState(false)
  const page = useAsync<{ kind: string; data: Page<Row> }>(
    () =>
      config
        ? config.load(0).then((data) => ({ kind, data }))
        : Promise.resolve({ kind, data: { items: [], total: 0, limit: PAGE_SIZE, offset: 0 } }),
    [kind],
  )

  useEffect(() => {
    setExtra([])
    setMoreError('')
  }, [kind])

  if (!config) return <Navigate to="/me" replace />

  const data = page.data?.kind === kind ? page.data.data : null
  const items = data ? [...data.items, ...extra] : []
  const total = data?.total ?? 0

  async function loadMore() {
    if (busy || !data) return
    setBusy(true)
    setMoreError('')
    try {
      const offset = data.items.length + extra.length
      const next = await config.load(offset)
      const seen = new Set([...data.items, ...extra].map((row) => row.id))
      setExtra((current) => [...current, ...next.items.filter((row) => !seen.has(row.id))])
    } catch (e) {
      setMoreError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageContainer>
      <PageHeader title={config.title} backTo="/me" />
      {page.loading && !data && <LoadingState />}
      {page.error && !data && <ErrorState message={page.error} onRetry={page.reload} />}
      {!page.loading && !page.error && data && items.length === 0 && <EmptyState text={config.empty} />}
      <ul className={styles.list}>
        {items.map((row) => (
          <li key={row.id} className={styles.item}>
            {renderRow(kind, row)}
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