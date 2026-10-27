import { useEffect, useState } from 'react'
import client, { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { type Ticket, type Item } from '../types'
import Button from '../components/ui/Button'
import SelectInput from '../components/ui/SelectInput'
import TicketCard from '../components/TicketCard'
import LoadingIndicator from '../components/ui/LoadingIndicator'
import EmptyState from '../components/ui/EmptyState'
import styles from './Tickets.module.css'

export default function Tickets() {
  const { role, userId } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [mine, setMine] = useState<Item[]>([])
  const [itemId, setItemId] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState('')
  const [result, setResult] = useState('')

  async function load() {
    const r = await client.get('/tickets')
    setTickets(r.data)
  }
  useEffect(() => {
    let active = true
    Promise.all([client.get('/tickets'), role === 'student' ? client.get('/me/items') : Promise.resolve(null)])
      .then(([t, owned]) => {
        if (!active) return
        setTickets(t.data)
        if (owned) setMine((owned.data as Item[]).filter(i => i.direction === 'lost' && ['searching', 'reviewing'].includes(i.status)))
      }).catch(e => { if (active) setMsg(errorMessage(e)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [role])

  async function action(path: string, body?: unknown) {
    if (busy) return
    setBusy(true); setMsg('')
    try { await client.post(path, body); await load(); return true }
    catch (e) { setMsg(errorMessage(e)); return false }
    finally { setBusy(false) }
  }
  async function feedback(id: string) {
    if (!result.trim()) { setMsg('核查结果不能为空'); return }
    if (await action('/tickets/' + id + '/feedback', { result: result.trim() })) {
      setEditing(''); setResult('')
    }
  }

  const selectOptions = [
    { value: '', label: '选择本人未关闭的寻物记录' },
    ...mine.map(i => ({ value: i.id, label: i.title })),
  ]

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>协助工单</h1>

      {role === 'student' && (
        <div className={styles.applyArea}>
          <SelectInput
            options={selectOptions}
            value={itemId}
            onChange={setItemId}
            disabled={busy}
            aria-label="本人寻物记录"
          />
          <Button variant="primary" disabled={!itemId || busy} onClick={() => action('/tickets', { item_id: itemId })}>
            申请协助
          </Button>
        </div>
      )}

      {msg && <p className={styles.msg} role="status">{msg}</p>}

      {loading ? (
        <LoadingIndicator label="加载中…" />
      ) : tickets.length === 0 ? (
        <EmptyState title="暂无工单" description="申请工作人员协助来寻找你的物品" />
      ) : (
        <div className={styles.list}>
          {tickets.map(t => (
            <TicketCard
              key={t.id}
              ticket={t}
              role={role}
              userId={userId}
              busy={busy}
              editingId={editing}
              result={result}
              onAssign={(id) => action('/tickets/' + id + '/assign')}
              onStartFeedback={(id) => { setEditing(id); setResult(''); setMsg('') }}
              onSubmitFeedback={feedback}
              onCancelFeedback={() => { setEditing(''); setResult(''); setMsg('') }}
              onResultChange={setResult}
              onAuthorizeRoute={(id) => action('/tickets/' + id + '/authorize-route')}
            />
          ))}
        </div>
      )}
    </main>
  )
}
