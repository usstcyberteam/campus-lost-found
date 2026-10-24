import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { errorMessage } from '../utils/error'
import { createClaim } from '../api/claims'
import { abandonHelper, takeHelper } from '../api/helpers'
import { deleteItem, getCandidates, getItem, markItemFound, withdrawItem } from '../api/items'
import { listMyItems } from '../api/me'
import { useAsync } from '../hooks/useAsync'
import { useTTS } from '../hooks/useTTS'
import { useAuth } from '../auth/AuthContext'
import { createIdempotencyKey } from '../utils/id'
import {
  directionLabels,
  placeLabel,
  statusLabels,
  type Candidate,
  type HelperState,
  type HelperUser,
  type Item,
  type ItemStatus,
} from '../types'
import Button from '../components/Button'
import Card from '../components/Card'
import Field from '../components/Field'
import ErrorNotice from '../components/ErrorNotice'
import PageContainer from '../components/PageContainer'
import PageHeader from '../components/AppShell/PageHeader'
import PhotoGallery from '../components/PhotoGallery/PhotoGallery'
import FavoriteButton from '../components/Reactions/FavoriteButton'
import SharePoster from '../components/SharePoster'
import TranslatePopover from '../components/TranslatePopover'
import LikeButton from '../components/Reactions/LikeButton'
import CommentList from '../components/CommentList/CommentList'
import HelperList from '../components/HelperList/HelperList'
import Spinner from '../components/Spinner'
import styles from './ItemDetail.module.css'

export default function ItemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
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
  const [actionBusy, setActionBusy] = useState<'withdraw' | 'found' | null>(null)
  const [actionMsg, setActionMsg] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState('')
  const [helpers, setHelpers] = useState<HelperUser[]>([])
  const [helperState, setHelperState] = useState<HelperState | null>(null)
  const [helperBusy, setHelperBusy] = useState(false)
  const [helperMsg, setHelperMsg] = useState('')
  const key = useRef('')
  // 任务七/八：描述翻译浮层与分享卡片弹层
  const [translateOpen, setTranslateOpen] = useState(false)
  const [posterOpen, setPosterOpen] = useState(false)

  const { data: item, error, loading } = useAsync(() => getItem(id ?? ''), [id])
  // 语音播报：朗读标题与描述；切换/离开帖子时 hook 卸载自动停止
  const tts = useTTS()

  useEffect(() => {
    let active = true
    setCandidates([])
    setMine([])
    setSubmitted(false)
    setStatusOverride(null)
    setEvidence('')
    setLostItemId('')
    setMsg('')
    setActionMsg('')
    setDeleteMsg('')
    setHelpers(item?.helpers ?? [])
    setHelperState(null)
    setHelperMsg('')
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

  async function runAction(kind: 'withdraw' | 'found') {
    if (actionBusy) return
    setActionBusy(kind)
    setActionMsg('')
    try {
      const updated = kind === 'withdraw' ? await withdrawItem(id ?? '') : await markItemFound(id ?? '')
      setStatusOverride(updated.status)
      setActionMsg(kind === 'withdraw' ? '已撤销发布' : '已标记为已找回')
    } catch (e) {
      setActionMsg(errorMessage(e))
    } finally {
      setActionBusy(null)
    }
  }

  async function removeItem() {
    if (deleteBusy || !item) return
    setDeleteBusy(true)
    setDeleteMsg('')
    try {
      await deleteItem(item.id)
      navigate('/hall')
    } catch (e) {
      setDeleteMsg(errorMessage(e))
      setDeleteBusy(false)
    }
  }

  async function toggleHelper() {
    if (helperBusy || !item) return
    const active = helperState?.is_helper ?? item.is_helper
    setHelperBusy(true)
    setHelperMsg('')
    try {
      const result = active ? await abandonHelper(item.id) : await takeHelper(item.id)
      setHelperState(result)
      setHelperMsg(active ? '已放弃委托' : '已接取委托')
      const refreshed = await getItem(item.id)
      setHelpers(refreshed.helpers ?? [])
    } catch (e) {
      setHelperMsg(errorMessage(e))
    } finally {
      setHelperBusy(false)
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
        <Link to="/hall">返回大厅</Link>
      </PageContainer>
    )
  }
  if (!item) {
    return <PageContainer>记录不存在</PageContainer>
  }
  const status = statusOverride ?? item.status
  const isHelper = helperState?.is_helper ?? item.is_helper
  const canTake = item.direction === 'lost' && !item.is_owner && ['searching', 'reviewing'].includes(status)
  const canModerate = role === 'staff' || role === 'admin'
  const canEdit = item.is_owner === true && ['searching', 'pending', 'reviewing'].includes(status)
  const speechText = [item.title, item.description].filter(Boolean).join('。')
  return (
    <PageContainer>
      <PageHeader title={item.title} backTo="/hall" />
      <p>
        {directionLabels[item.direction]} · {item.category} · {statusLabels[status]}
      </p>
      <div className={styles.reactions}>
        <LikeButton itemId={item.id} liked={item.is_liked} count={item.like_count} />
        <FavoriteButton itemId={item.id} favorited={item.is_favorited} count={item.favorite_count} />
        {tts.isSupported && (
          <Button
            variant="secondary"
            aria-pressed={tts.speaking}
            onClick={() => (tts.speaking ? tts.stop() : tts.speak(speechText))}
          >
            {tts.speaking ? '🔇 停止朗读' : '🔊 朗读'}
          </Button>
        )}
        <Button variant="secondary" onClick={() => setPosterOpen(true)}>
          📤 生成分享卡片
        </Button>
      </div>
      {canTake && (
        <div className={styles.actions}>
          <Button
            variant={isHelper ? 'secondary' : 'primary'}
            loading={helperBusy}
            disabled={helperBusy}
            onClick={toggleHelper}
          >
            {helperBusy ? '处理中…' : isHelper ? '放弃接取' : '接取委托'}
          </Button>
        </div>
      )}
      {helperMsg && <p role="status">{helperMsg}</p>}
      {item.is_owner && ['searching', 'pending', 'reviewing'].includes(status) && (
        <div className={styles.actions}>
          {item.direction === 'lost' && status === 'searching' && (
            <Button loading={actionBusy === 'found'} disabled={actionBusy !== null} onClick={() => runAction('found')}>
              {actionBusy === 'found' ? '提交中…' : '我已找回'}
            </Button>
          )}
          <Button
            variant="secondary"
            loading={actionBusy === 'withdraw'}
            disabled={actionBusy !== null}
            onClick={() => runAction('withdraw')}
          >
            {actionBusy === 'withdraw' ? '撤销中…' : '撤销发布'}
          </Button>
        </div>
      )}
      {actionMsg && <p role="status">{actionMsg}</p>}
      {status === 'deleted' && (
        <p className={styles.hint}>该记录已被删除（下架），不会出现在大厅列表。</p>
      )}
      {(item.is_owner || canModerate) && status !== 'deleted' && (
        <div className={styles.actions}>
          {canEdit && (
            <Button variant="secondary" onClick={() => navigate(`/items/${item.id}/edit`)}>
              编辑
            </Button>
          )}
          <Button variant="danger" loading={deleteBusy} disabled={deleteBusy} onClick={removeItem}>
            {deleteBusy ? '删除中…' : item.is_owner ? '删除' : '下架'}
          </Button>
        </div>
      )}
      {deleteMsg && <p role="status">{deleteMsg}</p>}
      <div className={styles.descRow}>
        <p className={styles.descText}>{item.description}</p>
        <button
          type="button"
          className={styles.translateButton}
          onClick={() => setTranslateOpen(true)}
          title="翻译描述"
          aria-label="翻译帖子描述"
        >
          🌐
        </button>
      </div>
      <TranslatePopover open={translateOpen} sourceText={item.description} onClose={() => setTranslateOpen(false)} />
      <SharePoster open={posterOpen} item={item} onClose={() => setPosterOpen(false)} />
      {item.photos_hidden ? (
        <p className={styles.hint}>为防冒领，拾获照片仅发布者与工作人员可查看</p>
      ) : (
        item.photos &&
        item.photos.length > 0 && (
          <section className={styles.block}>
            <h2>物品照片</h2>
            <PhotoGallery photos={item.photos} />
          </section>
        )
      )}
      <p>地点：{item.building_name ? placeLabel(item) : item.location_area || '未知'}</p>
      {item.precise_location && <p>精确位置：{item.precise_location}</p>}
      {item.is_simulated && <p>演示记录 / 模拟位置</p>}
      {item.direction === 'lost' && (
        <HelperList
          itemId={item.id}
          helpers={helpers}
          canThank={item.is_owner === true && status === 'found'}
        />
      )}
      {item.direction === 'lost' && item.is_owner && (
        <section>
          <h2>候选匹配</h2>
          {candidates.length === 0 && <p>暂无候选，可补充线索或申请协助。</p>}
          {candidates.map((c) => (
            <Card key={c.found_item_id} className={styles.block}>
              <Link to={'/hall/' + c.found_item_id + '?lost=' + id}>{c.title}</Link>（{c.category} ·{' '}
              {c.location_area || '未知'}）
              <p>
                依据：{c.explanation} ｜ 来源：{c.source === 'rule' ? '规则推荐' : c.source}
              </p>
            </Card>
          ))}
          <Link to="/staff/tickets">申请工作人员协助</Link>
        </section>
      )}
      {item.direction === 'found' && role === 'student' && !item.is_owner && ['pending', 'reviewing'].includes(status) && (
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
      <CommentList itemId={item.id} />
    </PageContainer>
  )
}