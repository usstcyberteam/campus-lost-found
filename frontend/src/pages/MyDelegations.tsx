import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client, { errorMessage } from '../api/client'
import {
  claimStatusLabels,
  directionLabels,
  ticketStatusLabels,
  type Claim,
  type Item,
  type Ticket,
} from '../types'
import Badge from '../components/ui/Badge'
import StatusBadge from '../components/ui/StatusBadge'
import Tag from '../components/ui/Tag'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import LoadingIndicator from '../components/ui/LoadingIndicator'
import ErrorState from '../components/ui/ErrorState'
import EmptyState from '../components/ui/EmptyState'
import styles from './MyDelegations.module.css'

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

  if (loading) return <main className={styles.page}><LoadingIndicator label="加载中…" /></main>
  if (error) return <main className={styles.page}><ErrorState message={error} /></main>

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>我的委托</h1>

      {badges.length > 0 && (
        <div className={styles.badges}>
          {badges.map((b) => (
            <Badge key={b.id} variant="secondary">{b.kind}</Badge>
          ))}
        </div>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>我的发布</h2>
        {items.length === 0 ? (
          <EmptyState title="暂无发布" description="去大厅发布一条寻物或拾获信息吧" />
        ) : (
          <div className={styles.list}>
            {items.map((i) => (
              <Card key={i.id} variant="outlined" className={styles.itemCard}>
                <div className={styles.itemHeader}>
                  <Tag variant={i.direction === 'lost' ? 'coral' : 'mint'}>{directionLabels[i.direction]}</Tag>
                  <Link to={`/items/${i.id}`} className={styles.itemTitle}>{i.title}</Link>
                  <StatusBadge status={i.status} />
                </div>
                {i.layer_id && i.norm_x != null && i.norm_y != null && (
                  <Button variant="secondary" size="sm" onClick={() => window.location.href = `/map?layer=${i.layer_id}&nx=${i.norm_x}&ny=${i.norm_y}&item=${i.id}`}>
                    地图定位
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>我的认领</h2>
        {claims.length === 0 ? (
          <EmptyState title="暂无认领" />
        ) : (
          <div className={styles.list}>
            {claims.map((c) => (
              <Card key={c.id} variant="outlined" className={styles.itemCard}>
                <div className={styles.itemHeader}>
                  <Link to={`/items/${c.found_item_id}`} className={styles.itemTitle}>认领物品</Link>
                  <Badge variant={c.status === 'pending' ? 'coral' : c.status === 'approved' ? 'mint' : c.status === 'completed' ? 'mint' : 'danger'}>
                    {claimStatusLabels[c.status]}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>我的工单</h2>
        {tickets.length === 0 ? (
          <EmptyState title="暂无工单" />
        ) : (
          <div className={styles.list}>
            {tickets.map((t) => (
              <Card key={t.id} variant="outlined" className={styles.itemCard}>
                <div className={styles.itemHeader}>
                  <span className={styles.itemTitle}>工单 {t.id.slice(0, 8)}</span>
                  <Badge variant={t.status === 'pending' ? 'coral' : t.status === 'processing' ? 'primary' : 'mint'}>
                    {ticketStatusLabels[t.status]}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
