import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import client, { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { directionLabels, statusLabels, type Candidate, type Item } from '../types'

export default function ItemDetail() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const requestedLost = params.get('lost')
  const { role } = useAuth()
  const [item, setItem] = useState<Item | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [mine, setMine] = useState<Item[]>([])
  const [evidence, setEvidence] = useState('')
  const [lostItemId, setLostItemId] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const key = useRef('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setCandidates([])
    setSubmitted(false)
    setEvidence('')
    setLostItemId('')
    setMsg('')
    client.get('/items/' + id).then(async r => {
      if (!active) return
      setItem(r.data)
      if (r.data.direction === 'lost' && r.data.is_owner) {
        const c = await client.get('/items/' + id + '/candidates')
        if (active) setCandidates(c.data)
      }
      if (role === 'student' && r.data.direction === 'found') {
        const owned = await client.get('/me/items')
        if (active) {
          const lost = (owned.data as Item[]).filter(i => i.direction === 'lost' && ['searching', 'reviewing'].includes(i.status))
          setMine(lost)
          if (lost.some(i => i.id === requestedLost)) setLostItemId(requestedLost!)
        }
      }
    }).catch(e => { if (active) setError(errorMessage(e)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, role, requestedLost])

  useEffect(() => { key.current = '' }, [id, evidence, lostItemId])

  async function submitClaim() {
    if (busy || submitted) return
    if (!evidence.trim()) { setMsg('请填写私密认领证据'); return }
    setBusy(true)
    setMsg('')
    if (!key.current) key.current = crypto.randomUUID()
    try {
      await client.post('/claims', {
        found_item_id: id, lost_item_id: lostItemId || null,
        evidence: [{ kind: 'text', content: evidence.trim() }], idempotency_key: key.current,
      })
      setSubmitted(true)
      setItem(current => current ? { ...current, status: 'reviewing' } : current)
      setMsg('认领申请已提交，等待工作人员核验')
    } catch (e) { setMsg(errorMessage(e)) }
    finally { setBusy(false) }
  }

  if (loading) return <main className="page">加载中…</main>
  if (error) return <main className="page"><p role="alert">{error}</p><Link to="/">返回大厅</Link></main>
  if (!item) return <main className="page">记录不存在</main>
  return <main className="page">
    <h1>{item.title}</h1>
    <p>{directionLabels[item.direction]} · {item.category} · {statusLabels[item.status]}</p>
    <p>{item.description}</p>
    <p>地点：{item.location_area || '未知'}</p>
    {item.precise_location && <p>精确位置：{item.precise_location}</p>}
    {item.is_simulated && <p>演示记录 / 模拟位置</p>}
    {item.direction === 'lost' && item.is_owner && <section>
      <h2>候选匹配</h2>
      {candidates.length === 0 && <p>暂无候选，可补充线索或申请协助。</p>}
      {candidates.map(c => <article className="card" key={c.found_item_id}>
        <Link to={'/items/' + c.found_item_id + '?lost=' + id}>{c.title}</Link>（{c.category} · {c.location_area || '未知'}）
        <p>依据：{c.explanation} ｜ 来源：{c.source === 'rule' ? '规则推荐' : c.source}</p>
      </article>)}
      <Link to="/tickets">申请工作人员协助</Link>
    </section>}
    {item.direction === 'found' && role === 'student' && ['pending', 'reviewing'].includes(item.status) && <section className="card">
      <h2>认领该物品</h2>
      <label>私密认领证据<textarea aria-label="私密认领证据" value={evidence}
        onChange={e => setEvidence(e.target.value)} disabled={busy || submitted} maxLength={5000}
        placeholder="请描述未公开的标记、划痕等特征" style={{ width: '100%', minHeight: 90 }} /></label>
      <label>关联本人寻物记录<select aria-label="关联本人寻物记录" value={lostItemId}
        disabled={busy || submitted} onChange={e => setLostItemId(e.target.value)}>
        <option value="">不关联</option>{mine.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
      </select></label>
      <p><button disabled={busy || submitted} onClick={submitClaim}>{submitted ? '已提交申请' : busy ? '提交中…' : '提交认领'}</button></p>
      {msg && <p role="status">{msg}</p>}
    </section>}
  </main>
}
