import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { aiChat } from '../../api/ai'
import { useVoiceInput } from '../../hooks/useVoiceInput'
import type { AiChatResult, FormPatch } from '../../types'
import { errorMessage } from '../../utils/error'
import FAQPanel from './FAQPanel'
import styles from './AiFloatWidget.module.css'

const POS_KEY = 'ai-float-pos-side'
const PREFILL_QUERY = 'ai_prefill'
const DESKTOP_BAR_W = 48
const DESKTOP_BAR_H = 132
const MOBILE_BAR_W = 44
const MOBILE_BAR_H = 100
const PANEL_W = 340
const PANEL_H = 460
const DRAG_THRESHOLD = 5
const NOTICE_MS = 6000
const Y_MIN = 60
const BOTTOM_NAV_H = 60
const HANDLE_CLOSE_PX = 80
// 与团队断点一致：min-width: 768px 及以上为桌面布局
const DESKTOP_QUERY = '(min-width: 768px)'

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
  text: '你好，我是寻物侦探。说说你丢了或捡到了什么、大概在哪儿，我帮你把线索整理成发帖草稿。',
}

function isDesktopViewport(): boolean {
  return window.matchMedia(DESKTOP_QUERY).matches
}

let safeBottomCache: number | null = null

/** env() 只在 CSS 内求值，用一次性探针元素读出安全区像素值。 */
function getSafeBottom(): number {
  if (safeBottomCache !== null) return safeBottomCache
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;bottom:0;width:0;height:0;padding-bottom:env(safe-area-inset-bottom);visibility:hidden'
  document.body.appendChild(probe)
  safeBottomCache = parseFloat(getComputedStyle(probe).paddingBottom) || 0
  probe.remove()
  return safeBottomCache
}

function barSize(desktop: boolean): { w: number; h: number } {
  return desktop ? { w: DESKTOP_BAR_W, h: DESKTOP_BAR_H } : { w: MOBILE_BAR_W, h: MOBILE_BAR_H }
}

function clampY(y: number, barH: number, desktop: boolean): number {
  // 移动端须让出底部导航（60px + 安全区）
  const yMax = desktop
    ? Math.max(Y_MIN, window.innerHeight - 140)
    : Math.max(Y_MIN, window.innerHeight - BOTTOM_NAV_H - getSafeBottom() - barH - 12)
  return Math.min(Math.max(Y_MIN, y), yMax)
}

function clampPos(pos: Pos, barW: number, barH: number, desktop: boolean): Pos {
  return {
    x: Math.min(Math.max(0, pos.x), Math.max(0, window.innerWidth - barW)),
    y: clampY(pos.y, barH, desktop),
  }
}

function sideX(side: Side, barW: number): number {
  return side === 'left' ? 0 : Math.max(0, window.innerWidth - barW)
}

function defaultStored(desktop: boolean): StoredPos {
  const { h } = barSize(desktop)
  if (desktop) return { side: 'left', y: clampY((window.innerHeight - h) / 2, h, true) }
  // 移动端默认右下角：侧边垂直居中停靠在窄屏易误触
  return { side: 'right', y: clampY(window.innerHeight - BOTTOM_NAV_H - getSafeBottom() - h - 12, h, false) }
}

function loadStored(): StoredPos {
  const desktop = isDesktopViewport()
  const { h } = barSize(desktop)
  try {
    const raw = localStorage.getItem(POS_KEY)
    if (!raw) return defaultStored(desktop)
    const parsed = JSON.parse(raw) as StoredPos
    if (typeof parsed.y !== 'number') return defaultStored(desktop)
    return { side: parsed.side === 'right' ? 'right' : 'left', y: clampY(parsed.y, h, desktop) }
  } catch {
    return defaultStored(desktop)
  }
}

function hasPrefillValue(patch: FormPatch): boolean {
  return Object.values(patch).some((value) => value !== null && value !== undefined && value !== '')
}


/**
 * 多轮对话意图判定：方向词可能出现在此前任何一轮（用户首轮说"捡到钱包"，
 * 后续只补充"黑色、一食堂2楼"），须扫描全部用户消息，否则 direction 会错误回落为 lost。
 */
function routeForConversation(allUserTexts: string[]): RouteTarget | null {
  for (const text of allUserTexts) {
    if (/(丢了|丢失|遗失)/.test(text)) return { path: '/publish', direction: 'lost' }
    if (/(捡到|拾获|捡了)/.test(text)) return { path: '/publish', direction: 'found' }
  }
  for (const text of allUserTexts) {
    if (/(地图|位置)/.test(text)) return { path: '/map' }
  }
  return null
}

/** 消息与 form_patch 归位为可跳转的 toast 状态（发送与"整理草稿"共用）。 */
function applyResult(
  result: AiChatResult,
  userTexts: string[],
  setTarget: (t: RouteTarget | null) => void,
  setNotice: (n: string) => void,
  navigate: (path: string) => void,
  closePanel: () => void,
) {
  const route = routeForConversation(userTexts)
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

// 面板顶部侦探娘的状态说明，与头像表情一一对应
const MOOD_TEXT = {
  idle: '随时待命，说说你丢了什么',
  thinking: '正在推理线索…',
  wink: '线索整理好了',
  confused: '这条没太看懂，换个说法试试',
} as const

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
  const [isDesktop, setIsDesktop] = useState(() => isDesktopViewport())
  const [viewportH, setViewportH] = useState(() => window.visualViewport?.height ?? window.innerHeight)
  const [side, setSide] = useState<Side>(() => loadStored().side)
  const [pos, setPos] = useState<Pos>(() => {
    const stored = loadStored()
    const { w } = barSize(isDesktopViewport())
    return { x: sideX(stored.side, w), y: stored.y }
  })
  const drag = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0, distance: 0 })
  const handleDrag = useRef({ active: false, startY: 0, dy: 0 })
  const posRef = useRef(pos)
  const listRef = useRef<HTMLOListElement>(null)
  const noticeTimer = useRef(0)
  // 语音开始前输入框已有的手打内容：识别文本追加在其后，避免覆盖用户输入
  const voiceBaseRef = useRef('')
  const voice = useVoiceInput((partial) => {
    setText((voiceBaseRef.current + partial).slice(0, 2000))
  })
  // FAQ 面板与自动发送：选问题 → 填入输入框 → 下一渲染帧触发表单提交
  //（不能同步 requestSubmit：onSubmit 闭包会读到旧的 text state）
  const [faqOpen, setFaqOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const pendingFaqRef = useRef<string | null>(null)

  function onMicClick() {
    if (!voice.supported) {
      // 不支持的浏览器（Firefox/旧 Safari）也渲染按钮：点击给出明确提示而非静默
      setError('当前浏览器不支持语音输入，建议使用 Chrome 或 Edge')
      return
    }
    if (!voice.listening) voiceBaseRef.current = text
    voice.toggle()
  }

  function onFaqSelect(question: string) {
    setFaqOpen(false)
    if (busy) return
    pendingFaqRef.current = question
    setText(question)
  }

  // FAQ 问题填入后自动提交（走现有 chat 接口，与手打发送完全同一条链路）
  useEffect(() => {
    if (pendingFaqRef.current === null) return
    pendingFaqRef.current = null
    formRef.current?.requestSubmit()
  }, [text])

  posRef.current = pos

  // 发布 / 编辑页有自己的 AI 润色和底部提交栏，AI 页本身就是助手，地图页底部是抽屉：这些页不再叠一个悬浮入口
  const hidden = /^\/(login|register|admin|publish|ai$|map)|^\/items\/[^/]+\/edit/.test(location.pathname)
  const [tucked, setTucked] = useState(false)
  // 侦探娘表情：回复中托腮思考；回复完成眨眼、出错或降级歪头疑惑，2.5 秒后回到默认
  const [flash, setFlash] = useState<'wink' | 'confused' | null>(null)
  const mood = busy || draftBusy ? 'thinking' : (flash ?? 'idle')
  const avatarSrc = `/brand/detective/${mood}.webp`

  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(null), 2500)
    return () => window.clearTimeout(timer)
  }, [flash])

  // 预先加载其余表情，切换时不闪白
  useEffect(() => {
    for (const name of ['thinking', 'wink', 'confused']) new Image().src = `/brand/detective/${name}.webp`
  }, [])

  // 手机端滚动时把圆钮收到屏幕右缘，停下 0.6 秒后再探出来，避免挡住正在看的卡片
  useEffect(() => {
    if (isDesktop) return
    let timer = 0
    function onScroll() {
      setTucked(true)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setTucked(false), 600)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(timer)
    }
  }, [isDesktop])

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

  // 视口跨过 768px 断点时按当前停靠侧重置坐标，避免旧尺寸坐标越界
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY)
    function onChange() {
      setIsDesktop(mq.matches)
      const stored = loadStored()
      const { w } = barSize(mq.matches)
      setSide(stored.side)
      setPos({ x: sideX(stored.side, w), y: stored.y })
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // 键盘避让：visualViewport 高度注入 CSS 变量，压缩移动端面板高度
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onVvResize = () => setViewportH(vv.height)
    vv.addEventListener('resize', onVvResize)
    return () => vv.removeEventListener('resize', onVvResize)
  }, [])

  useEffect(() => {
    function onResize() {
      const { w, h } = barSize(isDesktop)
      setPos((prev) => clampPos({ ...prev, x: sideX(side, w) }, w, h, isDesktop))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [side, isDesktop])

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
    const { w, h } = barSize(isDesktop)
    setPos(clampPos({ x: drag.current.origX + dx, y: drag.current.origY + dy }, w, h, isDesktop))
  }

  function onPointerUp() {
    if (!drag.current.active) return
    drag.current.active = false
    setDragging(false)
    if (drag.current.distance < DRAG_THRESHOLD) {
      setOpen((value) => !value)
      return
    }
    const { w, h } = barSize(isDesktop)
    // 按松手时中心点 x 判断吸附侧，吸附并持久化 {side, y}
    const centerX = posRef.current.x + w / 2
    const snappedSide: Side = centerX < window.innerWidth / 2 ? 'left' : 'right'
    // 移动端松手吸附到下角，避免侧边条长期遮挡内容中部
    const snappedY = isDesktop
      ? posRef.current.y
      : clampY(window.innerHeight - BOTTOM_NAV_H - getSafeBottom() - h - 12, h, false)
    const snapped = clampPos({ x: sideX(snappedSide, w), y: snappedY }, w, h, isDesktop)
    setSide(snappedSide)
    setPos(snapped)
    posRef.current = snapped
    localStorage.setItem(POS_KEY, JSON.stringify({ side: snappedSide, y: snapped.y } satisfies StoredPos))
  }

  /** 移动端把手：下拉超过阈值关闭面板。 */
  function onHandlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    handleDrag.current = { active: true, startY: e.clientY, dy: 0 }
  }

  function onHandlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!handleDrag.current.active) return
    handleDrag.current.dy = Math.max(0, e.clientY - handleDrag.current.startY)
  }

  function onHandlePointerUp() {
    if (!handleDrag.current.active) return
    handleDrag.current.active = false
    if (handleDrag.current.dy >= HANDLE_CLOSE_PX) setOpen(false)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const value = text.trim()
    if (!value || busy) return
    // 语音识别中直接发送：先停止识别并清基线，避免识别回调把已发送内容写回输入框
    if (voice.listening) {
      voice.stop()
      voiceBaseRef.current = ''
    }
    setText('')
    setError('')
    setNotice('')
    setTarget(null)
    setMessages((prev) => [...prev, { role: 'user', text: value }])
    setBusy(true)
    try {
      // 多轮上下文：带最近 5 轮（10 条）历史，模型累积理解信息再决定追问或出草稿
      const history = messages.slice(-10).map((message) => ({
        role: message.role,
        text: message.text,
      }))
      const result: AiChatResult = await aiChat(value, location.pathname, undefined, history)
      setMessages((prev) => [...prev, { role: 'assistant', text: result.reply, degraded: result.degraded }])
      setFlash(result.degraded ? 'confused' : 'wink')
      // 方向词可能在历史任一轮：传全部用户文本判定，避免多轮补充时 direction 回落 lost
      const userTexts = [...messages.filter((m) => m.role === 'user').map((m) => m.text), value]
      applyResult(result, userTexts, setTarget, setNotice, navigate, () => setOpen(false))
    } catch (err) {
      setError(errorMessage(err))
      setFlash('confused')
    } finally {
      setBusy(false)
    }
  }

  /** P2：把最近一条用户消息强制整理为发布草稿（action=draft，后端强制提取）。 */
  async function onDraftClick() {
    if (draftBusy || busy) return
    const lastUserIndex = messages.map((m) => m.role === 'user').lastIndexOf(true)
    if (lastUserIndex === -1) {
      setError('先在下方输入物品描述，再点整理草稿。')
      return
    }
    const lastUser = messages[lastUserIndex]
    setError('')
    setNotice('')
    setTarget(null)
    setDraftBusy(true)
    try {
      // history 取 lastUser 之前的消息（不重复传入 lastUser 本身），多轮信息也能攒齐
      const history = messages
        .slice(0, lastUserIndex)
        .slice(-10)
        .map((message) => ({ role: message.role, text: message.text }))
      const result: AiChatResult = await aiChat(lastUser.text, 'ai', 'draft', history)
      setMessages((prev) => [...prev, { role: 'assistant', text: result.reply, degraded: result.degraded }])
      if (result.form_patch && hasPrefillValue(result.form_patch)) {
        // 方向词可能在历史任一轮用户消息：扫描全部用户文本，避免 direction 回落 lost
        const userTexts = messages.filter((m) => m.role === 'user').map((m) => m.text)
        const route = routeForConversation(userTexts)
        setTarget({
          path: '/publish',
          direction: route?.direction ?? 'lost',
          patch: result.form_patch,
        })
        setNotice('已整理草稿，点击跳转发布')
        setFlash('wink')
      } else {
        setError('未能从对话中提取到发布信息，请补充描述。')
        setFlash('confused')
      }
    } catch (err) {
      setError(errorMessage(err))
      setFlash('confused')
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

  const barW = isDesktop ? DESKTOP_BAR_W : MOBILE_BAR_W
  const barH = isDesktop ? DESKTOP_BAR_H : MOBILE_BAR_H
  const panelH = Math.min(PANEL_H, window.innerHeight - 24)
  const panelW = Math.min(PANEL_W, window.innerWidth - barW - 24)
  const panelX = side === 'left' ? barW + 16 : Math.max(8, pos.x - panelW - 16)
  const panelY = Math.min(Math.max(8, pos.y + barH / 2 - panelH / 2), Math.max(8, window.innerHeight - panelH - 8))

  return (
    <>
      <div
        className={`${styles.panelAnchor} ${dragging && isDesktop ? '' : styles.anchorSnap}`}
        style={
          isDesktop
            ? { transform: `translate(${panelX}px, ${panelY}px)` }
            : ({ '--aifloat-vvh': `${viewportH}px` } as CSSProperties)
        }
      >
        <section
          className={`${styles.panel} ${side === 'right' ? styles.panelRight : ''} ${
            open ? styles.panelOpen : ''
          } ${isDesktop ? '' : styles.panelMobile}`}
          aria-hidden={!open}
        >
          {!isDesktop && (
            <div
              className={styles.handle}
              aria-label="下拉关闭"
              onPointerDown={onHandlePointerDown}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp}
              onPointerCancel={onHandlePointerUp}
            />
          )}
          <div className={styles.persona}>
            <img className={styles.personaAvatar} src={avatarSrc} alt="" />
            <div>
              <p className={styles.personaName}>寻物侦探</p>
              <p className={styles.personaStatus} aria-live="polite">
                {MOOD_TEXT[mood]}
              </p>
            </div>
          </div>
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
          <button type="button" className={styles.draftButton} onClick={onDraftClick} disabled={draftBusy || busy}>
            {draftBusy ? '整理中…' : '📝 整理为发布草稿'}
          </button>
          <form className={styles.form} onSubmit={onSubmit} ref={formRef}>
            <textarea
              className={styles.input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="例如：今天在图书馆3楼丢了蓝色折叠伞"
              maxLength={2000}
              disabled={busy}
              readOnly={voice.listening}
              aria-label="发给 AI 助手的消息"
            />
            <button
              type="button"
              className={styles.faqButton}
              onClick={() => setFaqOpen(true)}
              disabled={busy}
              title="常见问题"
              aria-label="打开常见问题面板"
              aria-expanded={faqOpen}
            >
              ？
            </button>
            <button
              type="button"
              className={`${styles.mic} ${voice.listening ? styles.micListening : ''}`}
              onClick={onMicClick}
              disabled={busy}
              title={voice.supported ? '语音输入' : '当前浏览器不支持语音输入，建议使用 Chrome 或 Edge'}
              aria-label={voice.listening ? '停止语音输入' : '语音输入'}
              aria-pressed={voice.listening}
            >
              {voice.listening ? '⏹' : '🎤'}
            </button>
            <button type="submit" className={styles.send} disabled={busy || !text.trim()}>
              发送
            </button>
          </form>
          {(error || voice.error) && <p className={styles.error}>{error || voice.error}</p>}
        </section>
      </div>
      {isDesktop ? (
        <button
          type="button"
          className={`${styles.bar} ${side === 'right' ? styles.barRight : ''} ${dragging ? '' : styles.barSnap}`}
          style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, width: barW, height: barH }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-label="AI 助手"
          aria-expanded={open}
          title="AI 助手（可拖动）"
        >
          <span className={styles.barInner}>
            <img src={avatarSrc} alt="" draggable={false} />
            <span className={styles.barLabel}>AI</span>
          </span>
        </button>
      ) : (
        <button
          type="button"
          className={`${styles.barMobile} ${open ? styles.barMobileHidden : ''} ${tucked ? styles.barMobileTucked : ''}`}
          onClick={() => setOpen((value) => !value)}
          aria-label="AI 助手"
          aria-expanded={open}
        >
          <img src={avatarSrc} alt="" draggable={false} />
        </button>
      )}
      <FAQPanel open={faqOpen} onClose={() => setFaqOpen(false)} onSelect={onFaqSelect} />
    </>
  )
}
