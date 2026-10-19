import { useEffect, useState } from 'react'
import { likeItem, unlikeItem } from '../../api/reactions'
import { errorMessage } from '../../utils/error'
import Button from '../ui/Button'
import styles from './ReactionButtons.module.css'

interface LikeButtonProps {
  itemId: string
  liked: boolean
  count: number
}

export default function LikeButton({ itemId, liked, count }: LikeButtonProps) {
  const [state, setState] = useState({ liked, count })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setState({ liked, count })
  }, [liked, count])

  async function toggle() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = state.liked ? await unlikeItem(itemId) : await likeItem(itemId)
      setState({ liked: result.liked, count: result.like_count })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <Button variant="secondary" aria-pressed={state.liked} disabled={busy} onClick={toggle}>
        {state.liked ? '已点赞' : '点赞'} · {state.count}
      </Button>
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}