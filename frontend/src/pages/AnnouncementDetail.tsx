import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { favoriteAnnouncement, getAnnouncement, unfavoriteAnnouncement } from '../api/announcements'
import { useAsync } from '../hooks/useAsync'
import { errorMessage } from '../utils/error'
import Button from '../components/ui/Button'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import Tag from '../components/ui/Tag'
import PageContainer from '../components/PageContainer'
import PageHeader from '../components/AppShell/PageHeader'
import styles from './Announcements.module.css'

export default function AnnouncementDetail() {
  const { id } = useParams()
  const { data: announcement, loading, error, reload } = useAsync(() => getAnnouncement(id ?? ''), [id])
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  async function toggleFavorite() {
    if (!announcement || busy) return
    setBusy(true)
    setActionError('')
    try {
      if (announcement.is_favorited) {
        await unfavoriteAnnouncement(announcement.id)
      } else {
        await favoriteAnnouncement(announcement.id)
      }
      reload()
    } catch (e) {
      setActionError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    )
  }
  if (error) {
    return (
      <PageContainer>
        <ErrorState message={error} onRetry={reload} />
        <Link to="/announcements">返回公告列表</Link>
      </PageContainer>
    )
  }
  if (!announcement) {
    return <PageContainer>公告不存在</PageContainer>
  }

  return (
    <PageContainer>
      <PageHeader title={announcement.title} backTo="/announcements" />
      <div className={styles.head}>
        {announcement.is_pinned && <Tag tone="primary">置顶</Tag>}
        <span className={styles.meta}>
          {announcement.author_name || '管理员'} · {new Date(announcement.created_at).toLocaleString('zh-CN')}
        </span>
      </div>
      <p className={styles.body}>{announcement.content}</p>
      {actionError && <ErrorState message={actionError} />}
      <Button variant="secondary" loading={busy} disabled={busy} onClick={toggleFavorite}>
        {announcement.is_favorited ? '已收藏' : '收藏'} · {announcement.favorite_count}
      </Button>
    </PageContainer>
  )
}