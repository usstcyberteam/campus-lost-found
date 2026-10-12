import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client, { errorMessage } from '../api/client'
import {
  claimStatusLabels,
  directionLabels,
  statusLabels,
  ticketStatusLabels,
  type Claim,
  type Item,
  type Ticket,
} from '../types'

export default function MyDelegations() {
  const [items, setItems] = useState<Item[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [badges, setBadges] = useState<{ id: string; kind: string }[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.all([client.get('/me/items'), client.get('/me/claims'), client.get('/me/tickets'), client.get('/me/badges')])
      .then(([i, c, t, b]) => { if (active) { setItems(i.data); setClaims(c.data); setTickets(t.data); setBadges(b.data) } })
      .catch(e => { if (active) setError(errorMessage(e)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) return <main className="page">加载中…</main>
  if (error) return <main className="page"><p role="alert">{error}</p></main>
  return (
    <div style={{ padding: 24 }}>
      <h1>我的委托</h1>
      {badges.length > 0 && <p>徽章：{badges.map((b) => b.kind).join('、')}</p>}

      <h2>我的发布</h2>
      {items.length === 0 && <p>暂无</p>}
      <ul>
        {items.map((i) => (
          <li key={i.id}>
            <Link to={`/items/${i.id}`}>
              [{directionLabels[i.direction]}] {i.title}
            </Link>{' '}
            · {statusLabels[i.status]}
            {' '}
            {i.layer_id && i.norm_x != null && i.norm_y != null && (
              <Link to={`/map?layer=${i.layer_id}&nx=${i.norm_x}&ny=${i.norm_y}&item=${i.id}`}>地图定位</Link>
            )}
          </li>
        ))}
      </ul>

      <h2>我的认领</h2>
      {claims.length === 0 && <p>暂无</p>}
      <ul>
        {claims.map((c) => (
          <li key={c.id}><Link to={'/items/' + c.found_item_id}>认领物品</Link> · {claimStatusLabels[c.status]}</li>
        ))}
      </ul>

      <h2>我的工单</h2>
      {tickets.length === 0 && <p>暂无</p>}
      <ul>
        {tickets.map((t) => (
          <li key={t.id}>{ticketStatusLabels[t.status]}</li>
        ))}
      </ul>
    </div>
  )
}
