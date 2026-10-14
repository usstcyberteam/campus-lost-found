import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { createClaim } from '../api/claims'
import { getCandidates, getItem } from '../api/items'
import { listMyItems } from '../api/me'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../auth/AuthContext'
import { createIdempotencyKey } from '../utils/id'
import { directionLabels, statusLabels, type Candidate, type Item, type ItemStatus } from '../types'
import Button from '../components/Button'
import Card from '../components/Card'
import Field from '../components/Field'
import ErrorNotice from '../components/ErrorNotice'
import PageContainer from '../components/PageContainer'
import Spinner from '../components/Spinner'
import styles from './ItemDetail.module.css'

export default function ItemDetail() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const requestedLost = params.get('lost')
  const { role } = useAuth()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [mine, setMine] = useState<Item[]>([])
  const [evidence, setEvidence] = useState('')
  const [lostItemId, setLostItemId] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [statusOverride, setStatusOverride] = useState<ItemStatus | null>(null)
  const key = useRef('')

  const { data: item, error, loading } = useAsync(() => getItem(id ?? ''), [id])

  useEffect(() => {
    let active = true
    setCandidates([])
    setMine([])
    setSubmitted(false)
    setStatusOverride(null)
    setEvidence('')
    setLostItemId('')
    setMsg('')
    if (!item) return
    if (item.direction === 'lost' && item.is_owner) {
      getCandidates(item.id)
        .then((c) => {
          if (active) setCandidates(c)
        })
        .catch(() => {})
    }
    if (role === 'student' && item.direction === 'found') {
      listMyItems()
        .then((page) => {
          if (!active) return
          const lost = page.items.filter(
            (i) => i.direction === 'lost' && ['searching', 'reviewing'].includes(i.status),
          )
          setMine(lost)
          if (lost.some((i) => i.id === requestedLost)) setLostItemId(requestedLost ?? '')
        })
        .catch(() => {})
    }
    return () => {
      active = false
    }
  }, [item, role, requestedLost])

  useEffect(() => {
    key.current = ''
  }, [id, evidence, lostItemId])

  async function submitClaim() {
    if (busy || submitted) return
    if (!evidence.trim()) {
      setMsg('请填写私密认领证据')
      return
    }
    setBusy(true)
    setMsg('')
    if (!key.current) key.current = createIdempotencyKey()
    try {
      await createClaim({
        found_item_id: id ?? '',
        lost_item_id: lostItemId || null,
        evidence: [{ kind: 'text', content: evidence.trim() }],
        idempotency_key: key.current,
      })
      setSubmitted(true)
      setStatusOverride('reviewing')
      setMsg('认领申请已提交，等待工作人员核验')
    } catch (e) {
      setMsg(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <Spinner />
      </PageContainer>
    )
  }
  if (error) {
    return (
      <PageContainer>
        <ErrorNotice message={error} />
        <Link to="/">返回大厅</Link>
      </PageContainer>
    )
  }
  if (!item) {
    return <PageContainer>记录不存在</PageContainer>
  }
  const status = statusOverride ?? item.status
  return (
    <PageContainer>
      <h1>{item.title}</h1>
      <p>
        {directionLabels[item.direction]} · {item.category} · {statusLabels[status]}
      </p>
      <p>{item.description}</p>
      <p>地点：{item.location_area || '未知'}</p>
      {item.precise_location && <p>精确位置：{item.precise_location}</p>}
      {item.is_simulated && <p>演示记录 / 模拟位置</p>}
      {item.direction === 'lost' && item.is_owner && (
        <section>
          <h2>候选匹配</h2>
          {candidates.length === 0 && <p>暂无候选，可补充线索或申请协助。</p>}
          {candidates.map((c) => (
            <Card key={c.found_item_id} className={styles.block}>
              <Link to={'/items/' + c.found_item_id + '?lost=' + id}>{c.title}</Link>（{c.category} ·{' '}
              {c.location_area || '未知'}）
              <p>
                依据：{c.explanation} ｜ 来源：{c.source === 'rule' ? '规则推荐' : c.source}
              </p>
            </Card>
          ))}
          <Link to="/tickets">申请工作人员协助</Link>
        </section>
      )}
      {item.direction === 'found' && role === 'student' && ['pending', 'reviewing'].includes(status) && (
        <Card className={styles.block}>
          <h2>认领该物品</h2>
          <Field label="私密认领证据">
            <textarea
              aria-label="私密认领证据"
              className={styles.textarea}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              disabled={busy || submitted}
              maxLength={5000}
              placeholder="请描述未公开的标记、划痕等特征"
            />
          </Field>
          <Field label="关联本人寻物记录">
            <select
              aria-label="关联本人寻物记录"
              value={lostItemId}
              disabled={busy || submitted}
              onChange={(e) => setLostItemId(e.target.value)}
            >
              <option value="">不关联</option>
              {mine.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
          </Field>
          <Button disabled={busy || submitted} loading={busy} onClick={submitClaim}>
            {submitted ? '已提交申请' : busy ? '提交中…' : '提交认领'}
          </Button>
          {msg && <p role="status">{msg}</p>}
        </Card>
      )}
    </PageContainer>
  )
}
