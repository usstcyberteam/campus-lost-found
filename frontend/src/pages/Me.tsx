import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { me } from '../api/auth'
import { getUnreadNotificationCount } from '../api/notifications'
import { listMyBadges, listMyClaims, listMyFavorites, listMyHelping, listMyItems } from '../api/me'
import { getMyPoints } from '../api/points'
import { applyStaffApplication } from '../api/staffApplications'
import { useAuth } from '../auth/AuthContext'
import { useAsync } from '../hooks/useAsync'
import { errorMessage } from '../utils/error'
import { pointProgress, type Role, type StaffStatus } from '../types'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import Field from '../components/Field'
import Input from '../components/ui/Input'
import LoadingState from '../components/ui/LoadingState'
import PageContainer from '../components/PageContainer'
import PageHeader from '../components/AppShell/PageHeader'
import Tag, { type TagTone } from '../components/ui/Tag'
import styles from './Me.module.css'

const STAFF_NO_PATTERN = /^[A-Za-z0-9]{4,20}$/
const BADGE_LABELS: Record<string, string> = { assist: '协助徽章' }

// 数据摘要行：把高频入口用数字前置（顺序按使用频次，index 对应 counts 数组）
const COUNT_ENTRIES = [
  { label: '我的发布', to: '/me/posts', index: 0 },
  { label: '我的收藏', to: '/me/favorites', index: 2 },
  { label: '我的认领', to: '/me/claims', index: 3 },
  { label: '我接取的', to: '/me/helping', index: 1 },
]

const CONTENT_ENTRIES = [
  { label: '我的通知', to: '/me/notifications' },
  { label: '我的发布', to: '/me/posts' },
  { label: '我接取的', to: '/me/helping' },
  { label: '我的收藏', to: '/me/favorites' },
  { label: '我的认领', to: '/me/claims' },
  { label: '我点赞的', to: '/me/likes' },
  { label: '我的评论', to: '/me/comments' },
  { label: '我的工单', to: '/me/tickets' },
  { label: '校园公告', to: '/announcements' },
  { label: '表扬墙', to: '/praises' },
]

function identityTag(role: Role | null, staffStatus: StaffStatus | null): { text: string; tone: TagTone } {
  if (role === 'admin') return { text: '管理员', tone: 'primary' }
  if (role === 'staff') return { text: '工作人员', tone: 'primary' }
  return staffStatus === 'pending' ? { text: '教职工审核中', tone: 'warning' } : { text: '学生', tone: 'neutral' }
}

function countText(counts: (number | null)[] | null, index: number): string {
  const value = counts?.[index]
  return counts ? (value == null ? '—' : String(value)) : '…'
}

function progressText(total: number, nextTitle: string | null, nextThreshold: number | null): string {
  if (nextThreshold == null || nextTitle == null) return '已达最高称号'
  return nextThreshold - total > 0 ? `再得 ${nextThreshold - total} 分成为 ${nextTitle}` : `已达成 ${nextTitle}`
}

export default function Me() {
  const { role, displayName, staffStatus, staffRejectReason, refresh, logout } = useAuth()
  const navigate = useNavigate()
  const [badgeOpen, setBadgeOpen] = useState(false)
  const [openApply, setOpenApply] = useState(false)
  const [staffNo, setStaffNo] = useState('')
  const [department, setDepartment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [applyError, setApplyError] = useState('')
  const [notice, setNotice] = useState('')
  const closeRef = useRef<HTMLButtonElement>(null)
  const identity = identityTag(role, staffStatus)
  const initial = (displayName ?? '').trim().charAt(0) || '寻'
  const points = useAsync(() => getMyPoints({ limit: 1, offset: 0 }), [])
  const counts = useAsync(async () => {
    const results = await Promise.allSettled([
      listMyItems({ limit: 1 }),
      listMyHelping({ limit: 1 }),
      listMyFavorites({ limit: 1 }),
      listMyClaims({ limit: 1 }),
    ])
    return results.map((result) => (result.status === 'fulfilled' ? result.value.total : null))
  }, [])
  const badges = useAsync(() => (badgeOpen ? listMyBadges() : Promise.resolve([])), [badgeOpen])
  const unread = useAsync(() => getUnreadNotificationCount(), [])
  const badgeList = badges.data ?? []
  const step = points.data ? Math.round(pointProgress(points.data.total, points.data.next_threshold) * 10) : 0

  useEffect(() => {
    if (!badgeOpen) return
    closeRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setBadgeOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [badgeOpen])

  async function openApplyForm() {
    setOpenApply(true)
    setApplyError('')
    try {
      const user = await me()
      setStaffNo(user.staff_no ?? '')
      setDepartment(user.department ?? '')
    } catch {
      // 预填失败不阻断手动填写
    }
  }

  async function submitApplication(event: FormEvent) {
    event.preventDefault()
    setApplyError('')
    if (!STAFF_NO_PATTERN.test(staffNo.trim())) {
      setApplyError('工号需为 4~20 位字母或数字')
      return
    }
    if (department.trim().length > 64) {
      setApplyError('部门不能超过 64 个字符')
      return
    }
    setSubmitting(true)
    try {
      await applyStaffApplication({ staff_no: staffNo.trim(), department: department.trim() || null })
      await refresh()
      setOpenApply(false)
      setNotice('申请已提交，等待审核')
    } catch (e) {
      setApplyError(errorMessage(e, '提交失败，请重试'))
    } finally {
      setSubmitting(false)
    }
  }

  function onLogout() {
    logout()
    navigate('/login')
  }

  return (
    <PageContainer>
      <PageHeader title="我的" />

      {/* 1. 身份卡：视觉锚点 */}
      <section className={styles.identity} aria-label="身份信息">
        <span className={styles.avatar} aria-hidden="true">
          {initial}
        </span>
        <div className={styles.identityBody}>
          <div className={styles.identityHead}>
            <h2 className={styles.name}>{displayName || '未设置昵称'}</h2>
            <Tag tone={identity.tone}>{identity.text}</Tag>
          </div>
          {points.loading && !points.data && <LoadingState text="正在加载积分…" />}
          {points.data && (
            <div className={styles.points}>
              <div className={styles.pointsHead}>
                <span className={styles.pointsTitle}>{points.data.title}</span>
                <span className={styles.score}>{points.data.total} 分</span>
              </div>
              {points.data.next_threshold != null && (
                <div
                  className={styles.progress}
                  role="progressbar"
                  aria-label="称号进度"
                  aria-valuemin={0}
                  aria-valuemax={points.data.next_threshold}
                  aria-valuenow={points.data.total}
                >
                  <div className={`${styles.bar} ${styles[`p${step}`]}`} />
                </div>
              )}
              <p className={styles.caption}>{progressText(points.data.total, points.data.next_title, points.data.next_threshold)}</p>
            </div>
          )}
        </div>
      </section>

      {points.error && !points.data && <ErrorState message={points.error} onRetry={points.reload} />}
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      {staffStatus === 'rejected' && (
        <div className={styles.reject}>
          <div className={styles.rejectHead}>
            <Tag tone="danger">申请未通过</Tag>
            <span className={styles.rejectReason}>{staffRejectReason || '未填写拒绝理由'}</span>
          </div>
          {!openApply ? (
            <Button variant="secondary" onClick={openApplyForm}>
              重新申请
            </Button>
          ) : (
            <form className={styles.applyForm} onSubmit={submitApplication}>
              <Field label="工号" htmlFor="apply-staff-no" required>
                <Input
                  id="apply-staff-no"
                  aria-label="工号"
                  placeholder="4~20 位字母或数字"
                  value={staffNo}
                  disabled={submitting}
                  onChange={(e) => setStaffNo(e.target.value)}
                />
              </Field>
              <Field label="部门" htmlFor="apply-department">
                <Input
                  id="apply-department"
                  aria-label="部门"
                  placeholder="部门（选填）"
                  value={department}
                  disabled={submitting}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </Field>
              {applyError && (
                <p className={styles.formError} role="alert">
                  {applyError}
                </p>
              )}
              <div className={styles.formActions}>
                <Button type="submit" loading={submitting}>
                  提交申请
                </Button>
                <Button type="button" variant="ghost" disabled={submitting} onClick={() => setOpenApply(false)}>
                  取消
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 2. 数据摘要行：高频入口前置 */}
      <nav className={styles.summary} aria-label="数据摘要">
        {COUNT_ENTRIES.map((entry) => {
          const text = countText(counts.data, entry.index)
          return (
            <Link key={entry.to} className={styles.summaryItem} to={entry.to} aria-label={`${entry.label}，${text} 条`}>
              <span className={styles.summaryValue}>{text}</span>
              <span className={styles.summaryLabel}>{entry.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* 3. 分组菜单 */}
      <section className={styles.group} aria-label="账户">
        <h2 className={styles.groupTitle}>账户</h2>
        <Link className={styles.entry} to="/me/profile">
          <span>资料修改</span>
          <span aria-hidden="true">›</span>
        </Link>
        <button type="button" className={styles.entry} onClick={onLogout}>
          <span>退出登录</span>
          <span aria-hidden="true">›</span>
        </button>
      </section>

      <section className={styles.group} aria-label="内容">
        <h2 className={styles.groupTitle}>内容</h2>
        {CONTENT_ENTRIES.map((entry) => {
          const showBadge = entry.to === '/me/notifications' && (unread.data ?? 0) > 0
          return (
            <Link
              key={entry.to}
              className={styles.entry}
              to={entry.to}
              aria-label={showBadge ? `我的通知，${unread.data} 条未读` : entry.label}
            >
              <span className={styles.entryLabel}>
                {entry.label}
                {showBadge && (
                  <span className={styles.badge} aria-hidden="true">
                    {unread.data}
                  </span>
                )}
              </span>
              <span aria-hidden="true">›</span>
            </Link>
          )
        })}
      </section>

      {(role === 'staff' || role === 'admin') && (
        <section className={styles.group} aria-label="工作人员">
          <h2 className={styles.groupTitle}>工作人员</h2>
          <Link className={styles.entry} to="/staff/claims">
            <span>认领审核</span>
            <span aria-hidden="true">›</span>
          </Link>
          <Link className={styles.entry} to="/staff/tickets">
            <span>工单处理</span>
            <span aria-hidden="true">›</span>
          </Link>
          <Link className={styles.entry} to="/staff/comments">
            <span>评论管理</span>
            <span aria-hidden="true">›</span>
          </Link>
          {role === 'admin' && (
            <>
              <Link className={styles.entry} to="/admin/staff-applications">
                <span>教职工审核</span>
                <span aria-hidden="true">›</span>
              </Link>
              <Link className={styles.entry} to="/admin/users">
                <span>用户管理</span>
                <span aria-hidden="true">›</span>
              </Link>
              <Link className={styles.entry} to="/admin/stats">
                <span>数据统计</span>
                <span aria-hidden="true">›</span>
              </Link>
              <Link className={styles.entry} to="/admin/announcements">
                <span>公告管理</span>
                <span aria-hidden="true">›</span>
              </Link>
            </>
          )}
        </section>
      )}

      <section className={styles.group} aria-label="关于">
        <h2 className={styles.groupTitle}>关于</h2>
        <button type="button" className={styles.entry} onClick={() => setBadgeOpen(true)}>
          <span>我的徽章</span>
          <span aria-hidden="true">›</span>
        </button>
        <Link className={styles.entry} to="/hall">
          <span>帮助与反馈：去大厅发起协助</span>
          <span aria-hidden="true">›</span>
        </Link>
      </section>

      {badgeOpen && (
        <div
          className={styles.overlay}
          onClick={(event) => {
            if (event.target === event.currentTarget) setBadgeOpen(false)
          }}
        >
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="badge-title">
            <div className={styles.dialogHead}>
              <h2 id="badge-title" className={styles.dialogTitle}>
                我的徽章
              </h2>
              <button
                ref={closeRef}
                type="button"
                className={styles.close}
                aria-label="关闭"
                onClick={() => setBadgeOpen(false)}
              >
                ×
              </button>
            </div>
            {badges.loading && <LoadingState />}
            {badges.error && <ErrorState message={badges.error} onRetry={badges.reload} />}
            {!badges.loading && !badges.error && badgeList.length === 0 && <EmptyState text="还没有获得徽章" />}
            <ul className={styles.badgeList}>
              {badgeList.map((badge) => (
                <li key={badge.id} className={styles.badgeRow}>
                  <Tag tone="primary">{BADGE_LABELS[badge.kind] ?? badge.kind}</Tag>
                  <span className={styles.badgeDate}>{new Date(badge.awarded_at).toLocaleDateString('zh-CN')}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </PageContainer>
  )
}