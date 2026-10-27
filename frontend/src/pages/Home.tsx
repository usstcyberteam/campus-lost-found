import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client, { errorMessage } from '../api/client'
import { type Direction, type Item, type ItemStatus } from '../types'
import HeroSection from '../components/HeroSection'
import SearchFilter from '../components/SearchFilter'
import ItemCard from '../components/ItemCard'
import LoadingIndicator from '../components/ui/LoadingIndicator'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import styles from './Home.module.css'

export default function Home() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Item[]>([])
  const [direction, setDirection] = useState<Direction | ''>('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState<ItemStatus | ''>('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const params: Record<string, string> = {}
    if (direction) params.direction = direction
    if (category) params.category = category
    if (status) params.status = status
    client.get('/items', { params }).then(res => { if (active) setItems(res.data) })
      .catch(e => { if (active) setError(errorMessage(e)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [direction, category, status])

  function clearFilters() {
    setDirection('')
    setCategory('')
    setStatus('')
  }

  return (
    <main className={styles.page}>
      <HeroSection
        onPublishLost={() => navigate('/publish?direction=lost')}
        onPublishFound={() => navigate('/publish?direction=found')}
      />

      <SearchFilter
        direction={direction}
        category={category}
        status={status}
        onDirectionChange={setDirection}
        onCategoryChange={setCategory}
        onStatusChange={setStatus}
      />

      {error && <ErrorState message={error} onRetry={() => { setError(''); setLoading(true) }} />}

      {loading && (
        <div className={styles.loadingContainer}>
          <LoadingIndicator label="加载中…" />
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          title="暂无符合条件的记录"
          description="试试调整筛选条件，或发布一条新的寻物/拾获信息"
          actionLabel="清除筛选"
          onAction={clearFilters}
        />
      )}

      {!loading && !error && items.length > 0 && (
        <div className={styles.grid}>
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </main>
  )
}
