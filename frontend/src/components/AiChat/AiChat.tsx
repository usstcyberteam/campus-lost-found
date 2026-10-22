import { useEffect, useRef, useState, type FormEvent } from 'react'
import { aiChat } from '../../api/ai'
import type { AiChatResult, FormPatch } from '../../types'
import { errorMessage } from '../../utils/error'
import Button from '../Button'
import ErrorNotice from '../ErrorNotice'
import styles from './AiChat.module.css'

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

interface AiChatProps {
  onPatch: (patch: FormPatch, result: AiChatResult) => void
  /** 快捷指令注入：token 变化时把 text 填入输入框（不直接发送，用户可修改） */
  presetText?: { text: string; token: number } | null
}

const WELCOME: ChatMessage = {
  role: 'assistant',
  text: '描述你丢失或拾获的物品，我会整理成发帖草稿。例如：今天下午在图书馆3楼丢了一把蓝色折叠伞。',
}

const PREFILL_NOTICE_MS = 3000

export default function AiChat({ onPatch, presetText }: AiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const listRef = useRef<HTMLOListElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const noticeTimer = useRef<number>(0)

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages])

  useEffect(() => {
    if (!presetText) return
    setText(presetText.text)
    inputRef.current?.focus()
  }, [presetText])

  useEffect(() => {
    if (!notice) return
    noticeTimer.current = window.setTimeout(() => setNotice(''), PREFILL_NOTICE_MS)
    return () => window.clearTimeout(noticeTimer.current)
  }, [notice])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const value = text.trim()
    if (!value || busy) return
    setText('')
    setError('')
    setMessages((prev) => [...prev, { role: 'user', text: value }])
    setBusy(true)
    try {
      const result = await aiChat(value)
      setMessages((prev) => [...prev, { role: 'assistant', text: result.reply }])
      if (result.form_patch) {
        onPatch(result.form_patch, result)
        setNotice('已帮你预填')
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.chat}>
      {notice && (
        <div className={styles.toast} role="status" aria-live="polite">
          {notice}
        </div>
      )}
      <ol className={styles.messages} ref={listRef} role="log" aria-live="polite">
        {messages.map((message, index) => (
          <li key={index} className={`${styles.message} ${styles[message.role]}`}>
            {message.text}
          </li>
        ))}
      </ol>
      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.label} htmlFor="ai-input">
          物品描述
        </label>
        <textarea
          id="ai-input"
          ref={inputRef}
          className={styles.input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例如：今天下午在图书馆3楼丢了一把蓝色折叠伞"
          maxLength={2000}
          disabled={busy}
        />
        <p className={styles.helper}>请勿填写手机号、证件号等敏感信息。</p>
        {error && <ErrorNotice message={error} />}
        <Button type="submit" loading={busy} disabled={!text.trim()}>
          发送
        </Button>
      </form>
    </div>
  )
}