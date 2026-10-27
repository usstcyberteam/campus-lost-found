import Button from './ui/Button'
import TextArea from './ui/TextArea'
import SelectInput from './ui/SelectInput'
import Tag from './ui/Tag'
import { type Item } from '../types'
import styles from './ClaimForm.module.css'

interface Props {
  evidence: string
  lostItemId: string
  lostItemOptions: Item[]
  busy: boolean
  submitted: boolean
  onEvidenceChange: (value: string) => void
  onLostItemIdChange: (value: string) => void
  onSubmit: () => void
  message: string
}

export default function ClaimForm({ evidence, lostItemId, lostItemOptions, busy, submitted, onEvidenceChange, onLostItemIdChange, onSubmit, message }: Props) {
  const options = [
    { value: '', label: '不关联' },
    ...lostItemOptions.map((i) => ({ value: i.id, label: i.title })),
  ]

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>认领该物品</h2>
        <Tag variant="secondary">私密</Tag>
      </div>

      <TextArea
        label="私密认领证据"
        placeholder="请描述未公开的标记、划痕等特征"
        value={evidence}
        onChange={onEvidenceChange}
        disabled={busy || submitted}
        maxLength={5000}
        aria-label="私密认领证据"
      />

      <SelectInput
        label="关联本人寻物记录"
        options={options}
        value={lostItemId}
        onChange={onLostItemIdChange}
        disabled={busy || submitted}
        aria-label="关联本人寻物记录"
      />

      <Button variant="primary" onClick={onSubmit} loading={busy} disabled={busy || submitted}>
        {submitted ? '已提交申请' : '提交认领'}
      </Button>

      {message && <p className={styles.message} role="status">{message}</p>}
    </div>
  )
}
