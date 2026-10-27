import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import client, { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { directionLabels, type Candidate, type Item } from '../types'
import Tag from '../components/ui/Tag'
import StatusBadge from '../components/ui/StatusBadge'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import LoadingIndicator from '../components/ui/LoadingIndicator'
import ErrorState from '../components/ui/ErrorState'
import CandidateCard from '../components/CandidateCard'
import ClaimForm from '../components/ClaimForm'
import styles from './ItemDetail.module.css'

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

  if (loading) return <main className={styles.page}><LoadingIndicator label="加载中…" /></main>
  if (error) return <main className={styles.page}><ErrorState message={error} /><Link to="/">返回大厅</Link></main>
  if (!item) return <main className={styles.page}><ErrorState message="记录不存在" /></main>

  const isLost = item.direction === 'lost'

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerTags}>
          <Tag variant={isLost ? 'coral' : 'mint'}>{directionLabels[item.direction]}</Tag>
          <StatusBadge status={item.status} />
          {item.is_simulated && <Tag variant="secondary">演示记录</Tag>}
        </div>
        <h1 className={styles.title}>{item.title}</h1>
        <p className={styles.category}>{item.category}</p>
      </div>

      <div className={styles.content}>
        <div className={styles.mainInfo}>
          <Card variant="outlined">
            <h2 className={styles.sectionTitle}>物品描述</h2>
            <p className={styles.description}>{item.description || '暂无描述'}</p>
          </Card>

          <Card variant="outlined">
            <h2 className={styles.sectionTitle}>位置信息</h2>
            <p className={styles.location}>地点：{item.location_area || '未知'}</p>
            {item.precise_location && <p className={styles.preciseLocation}>精确位置：{item.precise_location}</p>}
            {item.is_owner && item.layer_id && item.norm_x != null && item.norm_y != null && (
              <Button variant="secondary" size="sm" onClick={() => window.location.href = `/map?layer=${item.layer_id}&nx=${item.norm_x}&ny=${item.norm_y}&item=${item.id}`}>
                在地图查看位置
              </Button>
            )}
          </Card>
        </div>

        <div className={styles.sideInfo}>
          {isLost && item.is_owner && (
            <section className={styles.candidatesSection}>
              <h2 className={styles.sectionTitle}>候选匹配</h2>
              {candidates.length === 0 && <p className={styles.emptyHint}>暂无候选，可补充线索或申请协助。</p>}
              {candidates.map(c => <CandidateCard key={c.found_item_id} candidate={c} lostItemId={id!} />)}
              <Link to="/tickets"><Button variant="secondary" size="sm">申请工作人员协助</Button></Link>
            </section>
          )}

          {!isLost && role === 'student' && ['pending', 'reviewing'].includes(item.status) && (
            <ClaimForm
              evidence={evidence}
              lostItemId={lostItemId}
              lostItemOptions={mine}
              busy={busy}
              submitted={submitted}
              onEvidenceChange={setEvidence}
              onLostItemIdChange={setLostItemId}
              onSubmit={submitClaim}
              message={msg}
            />
          )}
        </div>
      </div>
    </main>
  )
}
