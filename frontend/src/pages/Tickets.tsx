import { useState } from 'react'
import { errorMessage } from '../utils/error'
import { listMyItems } from '../api/me'
import { assignTicket, authorizeRoute, createTicket, feedbackTicket, listTickets } from '../api/tickets'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../auth/AuthContext'
import { ticketStatusLabels } from '../types'
import Button from '../components/Button'
import Card from '../components/Card'
import Empty from '../components/Empty'
import ErrorNotice from '../components/ErrorNotice'
import Field from '../components/Field'
import PageContainer from '../components/PageContainer'
import Spinner from '../components/Spinner'
import styles from './Tickets.module.css'

export default function Tickets() {
  const { role, userId } = useAuth()
  const [itemId, setItemId] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState('')
  const [result, setResult] = useState('')

  const { data, error, loading, reload } = useAsync(
    () =>
      Promise.all([listTickets(), role === 'student' ? listMyItems() : Promise.resolve(null)]).then(([t, owned]) => ({
        tickets: t.items,
        mine: owned
          ? owned.items.filter((i) => i.direction === 'lost' && ['searching', 'reviewing'].includes(i.status))
          : [],
      })),
    [role],
  )
  const tickets = data?.tickets ?? []
  const mine = data?.mine ?? []

  async function apply() {
    if (!itemId || busy) return
    setBusy(true)
    setMessage('')
    try {
      await createTicket({ item_id: itemId })
      reload()
    } catch (e) {
      setMessage(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function assign(id: string) {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      await assignTicket(id)
      reload()
    } catch (e) {
      setMessage(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function authorize(id: string) {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      await authorizeRoute(id)
      reload()
    } catch (e) {
      setMessage(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function feedback(id: string) {
    if (!result.trim()) {
      setMessage('核查结果不能为空')
      return
    }
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      await feedbackTicket(id, { result: result.trim() })
      setEditing('')
      setResult('')
      reload()
    } catch (e) {
      setMessage(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageContainer>
      <h1>协助工单</h1>
      {role === 'student' && (
        <Field label="本人寻物记录">
          <div className={styles.applyRow}>
            <select aria-label="本人寻物记录" value={itemId} disabled={busy} onChange={(e) => setItemId(e.target.value)}>
              <option value="">选择本人未关闭的寻物记录</option>
              {mine.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
            <Button disabled={!itemId || busy} loading={busy} onClick={apply}>
              申请协助
            </Button>
          </div>
        </Field>
      )}
      {message && <p role="status">{message}</p>}
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorNotice message={error} />
      ) : tickets.length === 0 ? (
        <Empty text="暂无工单" />
      ) : (
        tickets.map((t) => (
          <Card key={t.id} className={styles.block}>
            <p>
              工单 {t.id.slice(0, 8)} · {ticketStatusLabels[t.status]}
            </p>
            {t.result && <p>结果：{t.result}</p>}
            {role === 'staff' && t.status === 'pending' && (
              <Button disabled={busy} onClick={() => assign(t.id)}>
                接单
              </Button>
            )}
            {role === 'staff' && t.status === 'processing' && t.assignee_user_id === userId && editing !== t.id && (
              <Button
                disabled={busy}
                onClick={() => {
                  setEditing(t.id)
                  setResult('')
                  setMessage('')
                }}
              >
                反馈结果
              </Button>
            )}
            {role === 'staff' && t.status === 'processing' && t.assignee_user_id === userId && editing === t.id && (
              <div className={styles.actions}>
                <Field label="核查结果">
                  <textarea
                    aria-label="核查结果"
                    value={result}
                    maxLength={5000}
                    disabled={busy}
                    onChange={(e) => setResult(e.target.value)}
                  />
                </Field>
                <Button disabled={busy} loading={busy} onClick={() => feedback(t.id)}>
                  提交反馈
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setEditing('')
                    setResult('')
                    setMessage('')
                  }}
                >
                  取消反馈
                </Button>
              </div>
            )}
            {t.requester_user_id === userId && !t.route_authorized && t.status !== 'feedback' && (
              <Button disabled={busy} onClick={() => authorize(t.id)}>
                授权接单人员查看我的路线
              </Button>
            )}
            {t.requester_user_id === userId && t.route_authorized && <p>已授权接单人员查看路线</p>}
          </Card>
        ))
      )}
    </PageContainer>
  )
}
