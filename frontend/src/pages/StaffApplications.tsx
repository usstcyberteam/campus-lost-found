import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { approveStaffApplication, listStaffApplications, rejectStaffApplication } from '../api/staffApplications'
import { errorMessage } from '../utils/error'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../auth/AuthContext'
import { staffStatusLabels, type StaffStatus } from '../types'
import Button from '../components/Button'
import Card from '../components/Card'
import Empty from '../components/Empty'
import ErrorNotice from '../components/ErrorNotice'
import Field from '../components/Field'
import PageContainer from '../components/PageContainer'
import Spinner from '../components/Spinner'
import Tag from '../components/Tag'
import styles from './StaffApplications.module.css'

function statusTone(status: StaffStatus): 'neutral' | 'warning' | 'success' | 'danger' {
  if (status === 'pending') return 'warning'
  if (status === 'approved') return 'success'
  if (status === 'rejected') return 'danger'
  return 'neutral'
}

export default function StaffApplications() {
  const { role } = useAuth()
  const [status, setStatus] = useState<StaffStatus>('pending')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const { data, loading, error, reload } = useAsync(() => listStaffApplications({ status }), [status])
  const applications = data?.items ?? []

  async function approve(userId: string) {
    setBusy(true)
    setMessage('')
    try {
      await approveStaffApplication(userId)
      setMessage('已通过申请，该用户角色已升级为工作人员')
      reload()
    } catch (e) {
      setMessage(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function reject() {
    if (!rejectingId) return
    if (!reason.trim()) {
      setMessage('请填写拒绝理由')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await rejectStaffApplication(rejectingId, reason.trim())
      setRejectingId(null)
      setReason('')
      setMessage('已拒绝该申请')
      reload()
    } catch (e) {
      setMessage(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (role !== 'admin') return <Navigate to="/hall" replace />
  return (
    <PageContainer>
      <h1>教职工申请审核</h1>
      <Field label="申请状态" htmlFor="application-status">
        <select
          id="application-status"
          value={status}
          disabled={busy}
          onChange={(e) => setStatus(e.target.value as StaffStatus)}
        >
          {Object.entries(staffStatusLabels).map(([key, value]) => (
            <option key={key} value={key}>
              {value}
            </option>
          ))}
        </select>
      </Field>
      {message && <p role="status">{message}</p>}
      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorNotice message={error} />
      ) : applications.length === 0 ? (
        <Empty text="暂无该状态的申请" />
      ) : (
        <ul className={styles.list}>
          {applications.map((application) => (
            <li key={application.user_id}>
              <Card className={styles.card}>
                <h2>{application.display_name}</h2>
                <p>用户名：{application.username}</p>
                <p>
                  工号：{application.staff_no || '未填写'} · 部门：{application.department || '未填写'}
                </p>
                <p>
                  <Tag tone={statusTone(application.staff_status)}>{staffStatusLabels[application.staff_status]}</Tag>
                </p>
                {application.staff_status === 'pending' && (
                  <div className={styles.actions}>
                    <Button disabled={busy} onClick={() => approve(application.user_id)}>
                      通过申请
                    </Button>
                    <Button
                      variant="danger"
                      disabled={busy}
                      onClick={() => {
                        setRejectingId(application.user_id)
                        setReason('')
                      }}
                    >
                      拒绝
                    </Button>
                  </div>
                )}
                {rejectingId === application.user_id && (
                  <div className={styles.reject}>
                    <Field
                      label="拒绝理由"
                      htmlFor={`reject-reason-${application.user_id}`}
                      required
                      error={message === '请填写拒绝理由' ? message : undefined}
                    >
                      <textarea
                        id={`reject-reason-${application.user_id}`}
                        aria-label="拒绝理由"
                        maxLength={500}
                        value={reason}
                        disabled={busy}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </Field>
                    <div className={styles.actions}>
                      <Button variant="danger" loading={busy} onClick={reject}>
                        确认拒绝
                      </Button>
                      <Button variant="secondary" disabled={busy} onClick={() => setRejectingId(null)}>
                        取消
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  )
}