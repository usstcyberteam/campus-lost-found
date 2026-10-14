import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client, { errorMessage } from '../api/client'
import { directionLabels, statusLabels, type Direction, type Item } from '../types'

export default function Home() {
  const [items, setItems] = useState<Item[]>([])
  const [direction, setDirection] = useState<Direction | ''>('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
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
    if (q) params.q = q
    client
      .get('/items', { params })
      .then((res) => {
        if (active) setItems(res.data.items)
      })
      .catch((e) => {
        if (active) setError(errorMessage(e))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [direction, category, status, q])

  return (
    <div style={{ padding: 24 }}>
      <h1>大厅</h1>
      {error && <p role="alert">{error}</p>}
      {loading && <p>加载中…</p>}
      {!loading && !error && items.length === 0 && <p>暂无符合条件的记录</p>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input placeholder="搜索标题、描述、类别" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={direction} onChange={(e) => setDirection(e.target.value as Direction | '')}>
          <option value="">全部类型</option>
          <option value="lost">寻物</option>
          <option value="found">拾获</option>
        </select>
        <input placeholder="类别" value={category} onChange={(e) => setCategory(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">全部状态</option>
          {Object.entries(statusLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {items.map((item) => (
          <li key={item.id} style={{ padding: 12, marginBottom: 8, background: '#fff', borderRadius: 8 }}>
            <Link to={`/items/${item.id}`}>
              <strong>[{directionLabels[item.direction]}]</strong> {item.title}
            </Link>
            <div style={{ color: '#6b7280', fontSize: 14 }}>
              {item.category} · {item.location_area || '未知地点'} · {statusLabels[item.status]}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
