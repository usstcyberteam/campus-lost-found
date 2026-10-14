import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { errorMessage } from '../utils/error'
import { completeClaim, getClaim, listClaims, reviewClaim } from '../api/claims'
import { getItem } from '../api/items'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../auth/AuthContext'
import { claimStatusLabels, type Claim, type ClaimDetail, type ClaimStatus, type Item } from '../types'
import Button from '../components/Button'
import Card from '../components/Card'
import Empty from '../components/Empty'
import Field from '../components/Field'
import PageContainer from '../components/PageContainer'
import Spinner from '../components/Spinner'
import styles from './StaffClaims.module.css'

export default function StaffClaims() {
  const { role } = useAuth()
  const [status, setStatus] = useState<ClaimStatus | ''>('pending')
  const [detail, setDetail] = useState<ClaimDetail | null>(null)
  const [found, setFound] = useState<Item | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [reason, setReason] = useState('')

  const { data, loading, reload } = useAsync(() => listClaims({ status: status || null }), [status])
  const claims = data?.items ?? []

  async function open(claim: Claim) {
    setBusy(true)
    setMessage('')
    setDetail(null)
    try {
      const [detailResponse, itemResponse] = await Promise.all([getClaim(claim.id), getItem(claim.found_item_id)])
      setDetail(detailResponse)
      setFound(itemResponse)
    } catch (e) {
      setMessage(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function act(action: 'approve' | 'reject' | 'complete') {
    if (!detail) return
    setBusy(true)
    setMessage('')
    try {
      let result: Claim
      if (action === 'complete') {
        result = await completeClaim(detail.id)
      } else {
        result = await reviewClaim(
          detail.id,
          action === 'approve' ? { approve: true } : { approve: false, reason: reason.trim() || undefined },
        )
      }
      setDetail({ ...detail, ...result })
      setReason('')
      reload()
      setMessage(action === 'complete' ? '已确认归还' : '审核结果已保存')
    } catch (e) {
      setMessage(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (role !== 'staff' && role !== 'admin') return <Navigate to="/" replace />
  return (
    <PageContainer>
      <h1>认领审核</h1>
      <Field label="申请状态">
        <select
          aria-label="申请状态"
          value={status}
          disabled={busy}
          onChange={(e) => setStatus(e.target.value as ClaimStatus | '')}
        >
          <option value="">全部</option>
          {Object.entries(claimStatusLabels).map(([key, value]) => (
            <option key={key} value={key}>
              {value}
            </option>
          ))}
        </select>
      </Field>
      {message && <p role="status">{message}</p>}
      {loading ? (
        <Spinner />
      ) : claims.length === 0 ? (
        <Empty text="暂无该状态的申请" />
      ) : (
        <ul>
          {claims.map((c) => (
            <li key={c.id}>
              申请 {c.id.slice(0, 8)} · {claimStatusLabels[c.status]}{' '}
              <Button variant="secondary" disabled={busy} onClick={() => open(c)}>
                查看证据
              </Button>
            </li>
          ))}
        </ul>
      )}
      {detail && (
        <Card className={styles.block}>
          <h2>{found?.title || '拾获物品'}</h2>
          <p>
            {found?.category} · {found?.location_area || '未知地点'}
          </p>
          <p>{found?.description}</p>
          <Link to={'/items/' + detail.found_item_id}>查看拾获详情</Link>
          {detail.lost_item_id && (
            <p>
              <Link to={'/items/' + detail.lost_item_id}>查看关联寻物</Link>
            </p>
          )}
          <h3>私密认领证据</h3>
          {detail.evidence.map((e, i) => (
            <p key={i}>
              {e.kind === 'image' ? '图片证据说明：' : ''}
              {e.content}
            </p>
          ))}
          <p>状态：{claimStatusLabels[detail.status]}</p>
          {detail.status === 'pending' && (
            <div className={styles.actions}>
              <Field label="拒绝理由（可选）">
                <textarea aria-label="拒绝理由" value={reason} disabled={busy} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <Button disabled={busy} loading={busy} onClick={() => act('approve')}>
                通过核验
              </Button>
              <Button variant="danger" disabled={busy} loading={busy} onClick={() => act('reject')}>
                拒绝申请
              </Button>
            </div>
          )}
          {detail.status === 'approved' && (
            <Button disabled={busy} loading={busy} onClick={() => act('complete')}>
              确认已交接归还
            </Button>
          )}
        </Card>
      )}
    </PageContainer>
  )
}
