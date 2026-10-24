import { useEffect } from 'react'
import styles from './FAQPanel.module.css'

const FAQ_QUESTIONS = [
  '捡到东西交到哪里？',
  '怎么联系失主？',
  '多久能找回？',
  '发布帖子需要注册吗？',
  'AI 助手能帮我做什么？',
  '匹配推送是怎么工作的？',
  '语音输入支持哪些浏览器？',
  '帖子可以修改/删除吗？',
]

interface FAQPanelProps {
  open: boolean
  onClose: () => void
  onSelect: (question: string) => void
}

/** FAQ 快捷面板：桌面居中弹窗 / 移动端全屏；点问题即发送给 AI 聊天。 */
export default function FAQPanel({ open, onClose, onSelect }: FAQPanelProps) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <section
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="常见问题"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>常见问题</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="关闭常见问题面板">
            ×
          </button>
        </header>
        <ul className={styles.list}>
          {FAQ_QUESTIONS.map((question) => (
            <li key={question}>
              <button type="button" className={styles.question} onClick={() => onSelect(question)}>
                <span className={styles.qMark} aria-hidden="true">
                  Q
                </span>
                <span className={styles.qText}>{question}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className={styles.hint}>点击问题会发送给 AI 助手，为你详细解答</p>
      </section>
    </div>
  )
}