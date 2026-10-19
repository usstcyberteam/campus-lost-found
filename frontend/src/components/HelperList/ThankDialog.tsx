import { useEffect, useState } from 'react'
import { thankHelpers } from '../../api/helpers'
import { errorMessage } from '../../utils/error'
import type { HelperUser } from '../../types'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import styles from './HelperList.module.css'

interface ThankDialogProps {
  itemId: string
  helpers: HelperUser[]
  onClose: () => void
  onThanked: (helperIds: string[]) => void
}

export default function ThankDialog({ itemId, helpers, onClose, onThanked }: ThankDialogProps) {
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  function toggle(helper: HelperUser) {
    if (helper.thanked || busy) return
    setSelected((prev) => {
      if (prev.includes(helper.id)) return prev.filter((id) => id !== helper.id)
      if (prev.length >= 3) return prev
      return [...prev, helper.id]
    })
  }

  async function submit() {
    if (busy) return
    if (selected.length === 0) {
      setError('请至少选择一位协助者')
      return
    }
    setBusy(true)
    setError('')
    try {
      await thankHelpers(itemId, selected)
      onThanked(selected)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.overlay} role="presentation">
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="thank-dialog-title">
        <h2 id="thank-dialog-title" className={styles.dialogTitle}>
          致谢协助者
        </h2>
        <p className={styles.dialogHint}>最多选择 3 人，每人获得 20 积分</p>
        <ul className={styles.choices}>
          {helpers.map((helper) => (
            <li key={helper.id}>
              <label className={`${styles.choice} ${helper.thanked ? styles.choiceDisabled : ''}`}>
                <input
                  type="checkbox"
                  checked={helper.thanked || selected.includes(helper.id)}
                  disabled={helper.thanked || busy}
                  onChange={() => toggle(helper)}
                />
                <Avatar name={helper.display_name} size="sm" />
                <span className={styles.choiceName}>{helper.display_name}</span>
                <span className={styles.choiceTitle}>{helper.thanked ? '已致谢' : helper.title}</span>
              </label>
            </li>
          ))}
        </ul>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.dialogActions}>
          <Button loading={busy} disabled={busy || selected.length === 0} onClick={submit}>
            {busy ? '提交中…' : '确认致谢'}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            取消
          </Button>
        </div>
      </div>
    </div>
  )
}