import { useState, type FormEvent } from 'react'
import { createComment } from '../../api/comments'
import { errorMessage } from '../../utils/error'
import type { Comment, Photo } from '../../types'
import Button from '../ui/Button'
import Textarea from '../ui/Textarea'
import PhotoUploader from '../PhotoUploader/PhotoUploader'
import styles from './CommentList.module.css'

interface CommentComposerProps {
  itemId: string
  parentId?: string | null
  replyTo?: string
  onCreated: (comment: Comment) => void
  onCancel?: () => void
}

export default function CommentComposer({
  itemId,
  parentId = null,
  replyTo,
  onCreated,
  onCancel,
}: CommentComposerProps) {
  const [content, setContent] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!content.trim()) {
      setError('请填写评论内容')
      return
    }
    setBusy(true)
    setError('')
    try {
      const created = await createComment(itemId, {
        content: content.trim(),
        parent_id: parentId,
        photo_ids: photos.map((photo) => photo.id),
      })
      setContent('')
      setPhotos([])
      onCreated(created)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={styles.composer} onSubmit={submit}>
      {replyTo && <p className={styles.replyTo}>回复 {replyTo}</p>}
      <Textarea
        label={parentId ? '回复内容' : '评论内容'}
        value={content}
        maxLength={500}
        rows={3}
        disabled={busy}
        onChange={(e) => setContent(e.target.value)}
      />
      <PhotoUploader photos={photos} onChange={setPhotos} max={3} disabled={busy} />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <Button type="submit" loading={busy} disabled={busy}>
          {busy ? '发布中…' : parentId ? '发布回复' : '发表评论'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            取消
          </Button>
        )}
      </div>
    </form>
  )
}