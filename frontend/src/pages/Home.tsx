import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listItems } from '../api/items'
import { useAsync } from '../hooks/useAsync'
import { useDebounce } from '../hooks/useDebounce'
import { directionLabels, statusLabels, type Direction, type ItemStatus } from '../types'
import Card from '../components/Card'
import Empty from '../components/Empty'
import ErrorNotice from '../components/ErrorNotice'
import PageContainer from '../components/PageContainer'
import Spinner from '../components/Spinner'
import styles from './Home.module.css'

export default function Home() {
  const [direction, setDirection] = useState<Direction | ''>('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState<ItemStatus | ''>('')
  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q, 300)
  const debouncedCategory = useDebounce(category, 300)

  const { data, error, loading } = useAsync(
    () =>
      listItems({
        direction: direction || null,
        category: debouncedCategory || null,
        status: status || null,
        q: debouncedQ || null,
      }),
    [direction, debouncedCategory, status, debouncedQ],
  )

  const items = data?.items ?? []

  return (
    <PageContainer>
      <h1>大厅</h1>
      {error && <ErrorNotice message={error} />}
      <div className={styles.filters}>
        <input placeholder="搜索标题、描述、类别" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={direction} onChange={(e) => setDirection(e.target.value as Direction | '')}>
          <option value="">全部类型</option>
          <option value="lost">寻物</option>
          <option value="found">拾获</option>
        </select>
        <input placeholder="类别" value={category} onChange={(e) => setCategory(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value as ItemStatus | '')}>
          <option value="">全部状态</option>
          {Object.entries(statusLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {loading && <Spinner />}
      {!loading && !error && items.length === 0 && <Empty text="暂无符合条件的记录" />}
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            <Card>
              <Link to={`/items/${item.id}`}>
                <strong>[{directionLabels[item.direction]}]</strong> {item.title}
              </Link>
              <div className={styles.meta}>
                {item.category} · {item.location_area || '未知地点'} · {statusLabels[item.status]}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </PageContainer>
  )
}
