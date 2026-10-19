import { useEffect, useState } from 'react'
import { favoriteItem, unfavoriteItem } from '../../api/reactions'
import { errorMessage } from '../../utils/error'
import Button from '../ui/Button'
import styles from './ReactionButtons.module.css'

interface FavoriteButtonProps {
  itemId: string
  favorited: boolean
  count: number
}

export default function FavoriteButton({ itemId, favorited, count }: FavoriteButtonProps) {
  const [state, setState] = useState({ favorited, count })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setState({ favorited, count })
  }, [favorited, count])

  async function toggle() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = state.favorited ? await unfavoriteItem(itemId) : await favoriteItem(itemId)
      setState({ favorited: result.favorited, count: result.favorite_count })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <Button variant="secondary" aria-pressed={state.favorited} disabled={busy} onClick={toggle}>
        {state.favorited ? '已收藏' : '收藏'} · {state.count}
      </Button>
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}