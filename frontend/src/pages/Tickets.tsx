import { useEffect, useState } from 'react'
import client, { errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ticketStatusLabels, type Ticket, type Item } from '../types'

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
        if (owned)
          setMine(
            (owned.data as Item[]).filter(
              (i) => i.direction === 'lost' && ['searching', 'reviewing'].includes(i.status),
            ),
          )
      })
      .catch((e) => {
        if (active) setMsg(errorMessage(e))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [role])

  async function action(path: string, body?: unknown) {
    if (busy) return
    setBusy(true)
    setMsg('')
    try {
      await client.post(path, body)
      await load()
      return true
    } catch (e) {
      setMsg(errorMessage(e))
      return false
    } finally {
      setBusy(false)
    }
  }
  async function feedback(id: string) {
    if (!result.trim()) {
      setMsg('核查结果不能为空')
      return
    }
    if (await action('/tickets/' + id + '/feedback', { result: result.trim() })) {
      setEditing('')
      setResult('')
    }
  }
  return (
    <main className="page">
      <h1>协助工单</h1>
      {role === 'student' && (
        <div className="actions">
          <select aria-label="本人寻物记录" value={itemId} disabled={busy} onChange={(e) => setItemId(e.target.value)}>
            <option value="">选择本人未关闭的寻物记录</option>
            {mine.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </select>
          <button disabled={!itemId || busy} onClick={() => action('/tickets', { item_id: itemId })}>
            申请协助
          </button>
        </div>
      )}
      {msg && <p role="status">{msg}</p>}
      {loading ? (
        <p>加载中…</p>
      ) : tickets.length === 0 ? (
        <p>暂无工单</p>
      ) : (
        tickets.map((t) => (
          <article className="card" key={t.id}>
            <p>
              工单 {t.id.slice(0, 8)} · {ticketStatusLabels[t.status]}
            </p>
            {t.result && <p>结果：{t.result}</p>}
            {role === 'staff' && t.status === 'pending' && (
              <button disabled={busy} onClick={() => action('/tickets/' + t.id + '/assign')}>
                接单
              </button>
            )}
            {role === 'staff' && t.status === 'processing' && t.assignee_user_id === userId && editing !== t.id && (
              <button
                disabled={busy}
                onClick={() => {
                  setEditing(t.id)
                  setResult('')
                  setMsg('')
                }}
              >
                反馈结果
              </button>
            )}
            {role === 'staff' && t.status === 'processing' && t.assignee_user_id === userId && editing === t.id && (
              <div>
                <label>
                  核查结果
                  <textarea
                    aria-label="核查结果"
                    value={result}
                    maxLength={5000}
                    disabled={busy}
                    onChange={(e) => setResult(e.target.value)}
                  />
                </label>
                <div className="actions">
                  <button disabled={busy} onClick={() => feedback(t.id)}>
                    提交反馈
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setEditing('')
                      setResult('')
                      setMsg('')
                    }}
                  >
                    取消反馈
                  </button>
                </div>
              </div>
            )}
            {t.requester_user_id === userId && !t.route_authorized && t.status !== 'feedback' && (
              <button disabled={busy} onClick={() => action('/tickets/' + t.id + '/authorize-route')}>
                授权接单人员查看我的路线
              </button>
            )}
            {t.requester_user_id === userId && t.route_authorized && <p>已授权接单人员查看路线</p>}
          </article>
        ))
      )}
    </main>
  )
}
