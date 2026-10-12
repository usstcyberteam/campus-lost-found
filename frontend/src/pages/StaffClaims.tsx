import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import client, { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { claimStatusLabels, type Claim, type ClaimDetail, type Item } from '../types'

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
  return <main className="page">
    <h1>认领审核</h1>
    <label>申请状态 <select aria-label="申请状态" value={status} disabled={busy} onChange={e => setStatus(e.target.value)}>
      <option value="">全部</option>
      {Object.entries(claimStatusLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
    </select></label>
    {message && <p role="status">{message}</p>}
    {loading ? <p>加载中…</p> : claims.length === 0 ? <p>暂无该状态的申请</p> : <ul>
      {claims.map(c => <li key={c.id}>
        申请 {c.id.slice(0, 8)} · {claimStatusLabels[c.status]} <button disabled={busy} onClick={() => open(c)}>查看证据</button>
      </li>)}
    </ul>}
    {detail && <section className="card">
      <h2>{found?.title || '拾获物品'}</h2>
      <p>{found?.category} · {found?.location_area || '未知地点'}</p>
      <p>{found?.description}</p>
      <Link to={'/items/' + detail.found_item_id}>查看拾获详情</Link>
      {detail.lost_item_id && <p><Link to={'/items/' + detail.lost_item_id}>查看关联寻物</Link></p>}
      <h3>私密认领证据</h3>
      {detail.evidence.map((e, i) => <p key={i}>{e.kind === 'image' ? '图片证据说明：' : ''}{e.content}</p>)}
      <p>状态：{claimStatusLabels[detail.status]}</p>
      {detail.status === 'pending' && <div className="actions">
        <button disabled={busy} onClick={() => act('approve')}>通过核验</button>
        <button disabled={busy} onClick={() => act('reject')}>拒绝申请</button>
      </div>}
      {detail.status === 'approved' && <button disabled={busy} onClick={() => act('complete')}>确认已交接归还</button>}
    </section>}
  </main>
}
