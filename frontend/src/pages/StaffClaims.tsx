import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import client, { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { claimStatusLabels, type Claim, type ClaimDetail, type Item } from '../types'
import SelectInput from '../components/ui/SelectInput'
import Badge from '../components/ui/Badge'
import ReviewPanel from '../components/ReviewPanel'
import LoadingIndicator from '../components/ui/LoadingIndicator'
import EmptyState from '../components/ui/EmptyState'
import styles from './StaffClaims.module.css'

export default function StaffClaims() {
  const { role } = useAuth()
  const [status, setStatus] = useState('pending')
  const [claims, setClaims] = useState<Claim[]>([])
  const [detail, setDetail] = useState<ClaimDetail | null>(null)
  const [found, setFound] = useState<Item | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (role !== 'staff') return
    let active = true
    setLoading(true)
    setMessage('')
    setDetail(null)
    setFound(null)
    client.get('/claims', { params: status ? { status } : {} })
      .then(r => { if (active) setClaims(r.data) })
      .catch(e => { if (active) setMessage(errorMessage(e)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [status, role])

  async function open(claim: Claim) {
    setBusy(true)
    setMessage('')
    setDetail(null)
    try {
      const [detailResponse, itemResponse] = await Promise.all([
        client.get('/claims/' + claim.id), client.get('/items/' + claim.found_item_id),
      ])
      setDetail(detailResponse.data)
      setFound(itemResponse.data)
    } catch (e) { setMessage(errorMessage(e)) }
    finally { setBusy(false) }
  }

  async function act(action: 'approve' | 'reject' | 'complete') {
    if (!detail) return
    setBusy(true)
    setMessage('')
    try {
      const path = '/claims/' + detail.id
      const r = action === 'complete' ? await client.post(path + '/complete')
        : await client.post(path + '/review', { approve: action === 'approve' })
      setDetail({ ...detail, ...r.data })
      const list = await client.get('/claims', { params: status ? { status } : {} })
      setClaims(list.data)
      setMessage(action === 'complete' ? '已确认归还' : '审核结果已保存')
    } catch (e) { setMessage(errorMessage(e)) }
    finally { setBusy(false) }
  }

  if (role !== 'staff') return <Navigate to="/" replace />

  const statusOptions = [
    { value: '', label: '全部' },
    ...Object.entries(claimStatusLabels).map(([key, value]) => ({ value: key, label: value })),
  ]

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>认领审核</h1>

      <div className={styles.filterBar}>
        <SelectInput
          label="申请状态"
          options={statusOptions}
          value={status}
          onChange={setStatus}
          disabled={busy}
          aria-label="申请状态"
        />
      </div>

      {message && <p className={styles.msg} role="status">{message}</p>}

      <div className={styles.layout}>
        <div className={styles.listPanel}>
          {loading ? (
            <LoadingIndicator label="加载中…" />
          ) : claims.length === 0 ? (
            <EmptyState title="暂无该状态的申请" />
          ) : (
            <div className={styles.claimList}>
              {claims.map(c => (
                <button
                  key={c.id}
                  className={`${styles.claimItem} ${detail?.id === c.id ? styles.claimItemActive : ''}`}
                  onClick={() => open(c)}
                  disabled={busy}
                >
                  <span className={styles.claimId}>申请 {c.id.slice(0, 8)}</span>
                  <Badge variant={c.status === 'pending' ? 'coral' : c.status === 'approved' ? 'mint' : c.status === 'completed' ? 'mint' : 'danger'}>
                    {claimStatusLabels[c.status]}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.detailPanel}>
          {detail && found !== null && (
            <ReviewPanel
              detail={detail}
              foundItem={found}
              busy={busy}
              onApprove={() => act('approve')}
              onReject={() => act('reject')}
              onComplete={() => act('complete')}
            />
          )}
        </div>
      </div>
    </main>
  )
}
