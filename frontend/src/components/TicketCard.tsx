import Button from './ui/Button'
import Badge from './ui/Badge'
import TextArea from './ui/TextArea'
import { ticketStatusLabels, type Ticket } from '../types'
import styles from './TicketCard.module.css'

interface Props {
  ticket: Ticket
  role: string | null
  userId: string | null
  busy: boolean
  editingId: string
  result: string
  onAssign: (id: string) => void
  onStartFeedback: (id: string) => void
  onSubmitFeedback: (id: string) => void
  onCancelFeedback: () => void
  onResultChange: (value: string) => void
  onAuthorizeRoute: (id: string) => void
}

export default function TicketCard({ ticket, role, userId, busy, editingId, result, onAssign, onStartFeedback, onSubmitFeedback, onCancelFeedback, onResultChange, onAuthorizeRoute }: Props) {
  const isRequester = ticket.requester_user_id === userId
  const isAssignee = ticket.assignee_user_id === userId

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.id}>工单 {ticket.id.slice(0, 8)}</span>
        <Badge variant={ticket.status === 'pending' ? 'coral' : ticket.status === 'processing' ? 'primary' : 'mint'}>
          {ticketStatusLabels[ticket.status]}
        </Badge>
      </div>

      {ticket.result && <p className={styles.result}>结果：{ticket.result}</p>}

      {role === 'staff' && ticket.status === 'pending' && (
        <Button variant="primary" size="sm" disabled={busy} onClick={() => onAssign(ticket.id)}>接单</Button>
      )}

      {role === 'staff' && ticket.status === 'processing' && isAssignee && editingId !== ticket.id && (
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => onStartFeedback(ticket.id)}>反馈结果</Button>
      )}

      {role === 'staff' && ticket.status === 'processing' && isAssignee && editingId === ticket.id && (
        <div className={styles.feedbackArea}>
          <TextArea
            label="核查结果"
            value={result}
            onChange={onResultChange}
            disabled={busy}
            maxLength={5000}
            aria-label="核查结果"
          />
          <div className={styles.feedbackActions}>
            <Button variant="primary" size="sm" disabled={busy} onClick={() => onSubmitFeedback(ticket.id)}>提交反馈</Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={onCancelFeedback}>取消</Button>
          </div>
        </div>
      )}

      {isRequester && !ticket.route_authorized && ticket.status !== 'feedback' && (
        <Button variant="primary" size="sm" disabled={busy} onClick={() => onAuthorizeRoute(ticket.id)}>
          授权接单人员查看我的路线
        </Button>
      )}

      {isRequester && ticket.route_authorized && (
        <Badge variant="mint">已授权</Badge>
      )}
    </div>
  )
}
