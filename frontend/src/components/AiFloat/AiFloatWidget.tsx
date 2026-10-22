import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { aiChat } from '../../api/ai'
import type { AiChatResult, FormPatch } from '../../types'
import { errorMessage } from '../../utils/error'
import styles from './AiFloatWidget.module.css'

const POS_KEY = 'ai-float-pos-side'
const PREFILL_QUERY = 'ai_prefill'
const BAR_W = 48
const BAR_H = 132
const PANEL_W = 340
const PANEL_H = 460
const DRAG_THRESHOLD = 5
const NOTICE_MS = 6000
const Y_MIN = 60

type Side = 'left' | 'right'

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  degraded?: boolean
}

interface Pos {
  x: number
  y: number
}

interface StoredPos {
  side: Side
  y: number
}

interface RouteTarget {
  path: string
  direction?: 'lost' | 'found'
  patch?: FormPatch
}

const WELCOME: ChatMessage = {
  role: 'assistant',
  text: '你好，我是校园失物招领助手。描述你丢失或拾获的物品，我帮你整理成发帖草稿。',
}

function clampY(y: number): number {
  const yMax = Math.max(Y_MIN, window.innerHeight - 140)
  return Math.min(Math.max(Y_MIN, y), yMax)
}

function clampPos(pos: Pos): Pos {
  return {
    x: Math.min(Math.max(0, pos.x), Math.max(0, window.innerWidth - BAR_W)),
    y: clampY(pos.y),
  }
}

function sideX(side: Side): number {
  return side === 'left' ? 0 : Math.max(0, window.innerWidth - BAR_W)
}

function defaultStored(): StoredPos {
  return { side: 'left', y: clampY((window.innerHeight - BAR_H) / 2) }
}

function loadStored(): StoredPos {
  try {
    const raw = localStorage.getItem(POS_KEY)
    if (!raw) return defaultStored()
    const parsed = JSON.parse(raw) as StoredPos
    if (typeof parsed.y !== 'number') return defaultStored()
    return { side: parsed.side === 'right' ? 'right' : 'left', y: clampY(parsed.y) }
  } catch {
    return defaultStored()
  }
}

function hasPrefillValue(patch: FormPatch): boolean {
  return Object.values(patch).some((value) => value !== null && value !== undefined && value !== '')
}

/** 前端意图规则：丢/捡优先于地图；命中时跳发布页并带预填，或跳地图页。 */
function routeFor(message: string): RouteTarget | null {
  if (/(丢了|丢失|遗失)/.test(message)) return { path: '/publish', direction: 'lost' }
  if (/(捡到|拾获|捡了)/.test(message)) return { path: '/publish', direction: 'found' }
  if (/(地图|位置)/.test(message)) return { path: '/map' }
  return null
}

/** 消息与 form_patch 归位为可跳转的 toast 状态（发送与"整理草稿"共用）。 */
function applyResult(
  result: AiChatResult,
  sourceText: string,
  setTarget: (t: RouteTarget | null) => void,
  setNotice: (n: string) => void,
  navigate: (path: string) => void,
  closePanel: () => void,
) {
  const route = routeFor(sourceText)
  if (result.form_patch && hasPrefillValue(result.form_patch)) {
    if (route?.path === '/publish' && route.direction) {
      setTarget({ ...route, patch: result.form_patch })
      setNotice('已整理信息，点击跳转')
    } else if (!route) {
      setTarget({ path: '/publish', direction: 'lost', patch: result.form_patch })
      setNotice('已整理草稿，点击跳转发布')
    } else {
      navigate('/map')
      closePanel()
    }
  } else if (route?.path === '/map') {
    navigate('/map')
    closePanel()
  }
}

export default function AiFloatWidget() {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [draftBusy, setDraftBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [target, setTarget] = useState<RouteTarget | null>(null)
  const [side, setSide] = useState<Side>(() => loadStored().side)
  const [pos, setPos] = useState<Pos>(() => {
    const stored = loadStored()
    return { x: sideX(stored.side), y: stored.y }
  })
  const drag = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0, distance: 0 })
  const posRef = useRef(pos)
  const listRef = useRef<HTMLOListElement>(null)
  const noticeTimer = useRef(0)

  posRef.current = pos

  const hidden = /^\/(login|register|admin)/.test(location.pathname)

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages, open])

  useEffect(() => {
    if (!notice) return
    noticeTimer.current = window.setTimeout(() => {
      setNotice('')
      setTarget(null)
    }, NOTICE_MS)
    return () => window.clearTimeout(noticeTimer.current)
  }, [notice])

  useEffect(() => {
    function onResize() {
      setPos((prev) => clampPos({ ...prev, x: sideX(side) }))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [side])

  function onPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: posRef.current.x,
      origY: posRef.current.y,
      distance: 0,
    }
    setDragging(true)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag.current.active) return
    const dx = e.clientX - drag.current.startX
    const dy = e.clientY - drag.current.startY
    drag.current.distance = Math.max(Math.abs(dx), Math.abs(dy))
    setPos(clampPos({ x: drag.current.origX + dx, y: drag.current.origY + dy }))
  }

  function onPointerUp() {
    if (!drag.current.active) return
    drag.current.active = false
    setDragging(false)
    if (drag.current.distance < DRAG_THRESHOLD) {
      setOpen((value) => !value)
      return
    }
    // 按松手时中心点 x 判断吸附侧，吸附并持久化 {side, y}
    const centerX = posRef.current.x + BAR_W / 2
    const snappedSide: Side = centerX < window.innerWidth / 2 ? 'left' : 'right'
    const snapped = clampPos({ x: sideX(snappedSide), y: posRef.current.y })
    setSide(snappedSide)
    setPos(snapped)
    posRef.current = snapped
    localStorage.setItem(POS_KEY, JSON.stringify({ side: snappedSide, y: snapped.y } satisfies StoredPos))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const value = text.trim()
    if (!value || busy) return
    setText('')
    setError('')
    setNotice('')
    setTarget(null)
    setMessages((prev) => [...prev, { role: 'user', text: value }])
    setBusy(true)
    try {
      const result: AiChatResult = await aiChat(value, location.pathname)
      setMessages((prev) => [...prev, { role: 'assistant', text: result.reply, degraded: result.degraded }])
      applyResult(
        result,
        value,
        setTarget,
        setNotice,
        navigate,
        () => setOpen(false),
      )
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  /** P2：把最近一条用户消息强制整理为发布草稿（action=draft，后端强制提取）。 */
  async function onDraftClick() {
    if (draftBusy || busy) return
    const lastUser = [...messages].reverse().find((message) => message.role === 'user')
    if (!lastUser) {
      setError('先在下方输入物品描述，再点整理草稿。')
      return
    }
    setError('')
    setNotice('')
    setTarget(null)
    setDraftBusy(true)
    try {
      const result: AiChatResult = await aiChat(lastUser.text, 'ai', 'draft')
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: result.reply, degraded: result.degraded },
      ])
      if (result.form_patch && hasPrefillValue(result.form_patch)) {
        const route = routeFor(lastUser.text)
        setTarget({
          path: '/publish',
          direction: route?.direction ?? 'lost',
          patch: result.form_patch,
        })
        setNotice('已整理草稿，点击跳转发布')
      } else {
        setError('未能从对话中提取到发布信息，请补充描述。')
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setDraftBusy(false)
    }
  }

  function onNoticeClick() {
    if (target?.path === '/publish' && target.direction && target.patch) {
      const payload = { ...target.patch, direction: target.direction }
      console.log('[AiFloat] navigating with prefill:', {
        title: payload.title,
        category: payload.category,
        location_area: payload.location_area,
        direction: payload.direction,
      })
      navigate(`${target.path}?${PREFILL_QUERY}=${encodeURIComponent(JSON.stringify(payload))}`)
      setOpen(false)
    }
    setNotice('')
    setTarget(null)
  }

  if (hidden) return null

  const panelH = Math.min(PANEL_H, window.innerHeight - 24)
  const panelW = Math.min(PANEL_W, window.innerWidth - BAR_W - 24)
  const panelX = side === 'left' ? BAR_W + 16 : Math.max(8, pos.x - panelW - 16)
  const panelY = Math.min(
    Math.max(8, pos.y + BAR_H / 2 - panelH / 2),
    Math.max(8, window.innerHeight - panelH - 8),
  )

  return (
    <>
      <div
        className={`${styles.panelAnchor} ${dragging ? '' : styles.anchorSnap}`}
        style={{ transform: `translate(${panelX}px, ${panelY}px)` }}
      >
        <section
          className={`${styles.panel} ${side === 'right' ? styles.panelRight : ''} ${
            open ? styles.panelOpen : ''
          }`}
          aria-hidden={!open}
        >
          {notice && (
            <button type="button" className={styles.notice} onClick={onNoticeClick}>
              {notice} →
            </button>
          )}
          <ol className={styles.messages} ref={listRef}>
            {messages.map((message, index) => (
              <li
                key={index}
                className={`${styles.message} ${
                  message.role === 'user' ? styles.messageUser : styles.messageAssistant
                }`}
              >
                {message.text}
                {message.role === 'assistant' && message.degraded && (
                  <span className={styles.ruleTag}>（规则模式）</span>
                )}
              </li>
            ))}
          </ol>
          <button
            type="button"
            className={styles.draftButton}
            onClick={onDraftClick}
            disabled={draftBusy || busy}
          >
            {draftBusy ? '整理中…' : '📝 整理为发布草稿'}
          </button>
          <form className={styles.form} onSubmit={onSubmit}>
            <textarea
              className={styles.input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="例如：今天在图书馆3楼丢了蓝色折叠伞"
              maxLength={2000}
              disabled={busy}
              aria-label="发给 AI 助手的消息"
            />
            <button type="submit" className={styles.send} disabled={busy || !text.trim()}>
              发送
            </button>
          </form>
          {error && <p className={styles.error}>{error}</p>}
        </section>
      </div>
      <button
        type="button"
        className={`${styles.bar} ${side === 'right' ? styles.barRight : ''} ${
          dragging ? '' : styles.barSnap
        }`}
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, width: BAR_W, height: BAR_H }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label="AI 助手"
        aria-expanded={open}
        title="AI 助手（可拖动）"
      >
        <span className={styles.barInner}>
          <img src="/ai-float.png" alt="" draggable={false} />
          <span className={styles.barLabel}>AI</span>
        </span>
      </button>
    </>
  )
}