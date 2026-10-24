import { useEffect, useRef, useState } from 'react'
import { aiChat, type TranslateTargetLang } from '../api/ai'
import { errorMessage } from '../utils/error'
import styles from './TranslatePopover.module.css'

const LANG_OPTIONS: { code: TranslateTargetLang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
]

const DEGRADED_TOAST = '翻译暂不可用，请稍后重试'

interface TranslatePopoverProps {
  open: boolean
  sourceText: string
  onClose: () => void
}

type TranslateState =
  | { phase: 'idle' }
  | { phase: 'loading'; lang: TranslateTargetLang }
  | { phase: 'done'; lang: TranslateTargetLang; translated: string }
  | { phase: 'error'; message: string }

/** 帖子描述翻译浮层：选语言 → 调 /ai/chat action=translate → 译文展示，可切回原文。 */
export default function TranslatePopover({ open, sourceText, onClose }: TranslatePopoverProps) {
  const [state, setState] = useState<TranslateState>({ phase: 'idle' })
  const [showOriginal, setShowOriginal] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setState({ phase: 'idle' })
    setShowOriginal(false)
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  async function onPick(lang: TranslateTargetLang) {
    if (state.phase === 'loading') return
    setState({ phase: 'loading', lang })
    setShowOriginal(false)
    try {
      const result = await aiChat(sourceText, 'items', 'translate', undefined, lang)
      if (result.degraded || !result.reply.trim()) {
        // 模型不可用/翻译为空：统一降级提示，不展示空译文
        setState({ phase: 'error', message: DEGRADED_TOAST })
        return
      }
      setState({ phase: 'done', lang, translated: result.reply.trim() })
    } catch (e) {
      setState({ phase: 'error', message: errorMessage(e) || DEGRADED_TOAST })
    }
  }

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.popover}
        role="dialog"
        aria-modal="true"
        aria-label="帖子描述翻译"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>🌐 翻译描述</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="关闭翻译浮层">
            ×
          </button>
        </header>

        <div className={styles.langRow} role="group" aria-label="选择目标语言">
          {LANG_OPTIONS.map((option) => (
            <button
              key={option.code}
              type="button"
              className={`${styles.langButton} ${
                (state.phase === 'loading' || state.phase === 'done') && state.lang === option.code
                  ? styles.langButtonActive
                  : ''
              }`}
              onClick={() => onPick(option.code)}
              disabled={state.phase === 'loading'}
              aria-pressed={
                (state.phase === 'loading' || state.phase === 'done') && state.lang === option.code
              }
            >
              {option.label}
            </button>
          ))}
        </div>

        {state.phase === 'loading' && (
          <div className={styles.body} aria-live="polite" aria-label="翻译中">
            <span className={styles.skeleton} />
            <span className={`${styles.skeleton} ${styles.skeletonShort}`} />
            <span className={`${styles.skeleton} ${styles.skeletonMid}`} />
          </div>
        )}

        {state.phase === 'done' && (
          <div className={styles.body}>
            <p className={styles.translated} lang={state.lang === 'en' ? 'en' : state.lang}>
              {showOriginal ? sourceText : state.translated}
            </p>
            <button
              type="button"
              className={styles.toggleOriginal}
              onClick={() => setShowOriginal((value) => !value)}
              aria-pressed={showOriginal}
            >
              {showOriginal ? '查看译文' : '查看原文'}
            </button>
          </div>
        )}

        {state.phase === 'error' && (
          <div className={styles.body} role="alert">
            <p className={styles.toast}>{state.message}</p>
          </div>
        )}
      </div>
    </div>
  )
}