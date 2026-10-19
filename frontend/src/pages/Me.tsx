import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { roleLabels, staffStatusLabels } from '../types'
import Button from '../components/Button'
import Card from '../components/Card'
import PageContainer from '../components/PageContainer'
import PageHeader from '../components/AppShell/PageHeader'
import styles from './Me.module.css'

export default function Me() {
  const { role, displayName, staffStatus, staffRejectReason, logout } = useAuth()
  const navigate = useNavigate()
  const isStaff = role === 'staff' || role === 'admin'

  function onLogout() {
    logout()
    navigate('/login')
  }

  return (
    <PageContainer>
      <PageHeader title="我的" />
      <Card className={styles.profile}>
        <h2>{displayName || '未设置昵称'}</h2>
        <p>身份：{role ? roleLabels[role] : '未登录'}</p>
        <p>教职工申请：{staffStatus ? staffStatusLabels[staffStatus] : '未申请'}</p>
        {staffStatus === 'rejected' && staffRejectReason && <p>拒绝理由：{staffRejectReason}</p>}
        <p className={styles.hint}>积分与称号将在后续版本展示。</p>
      </Card>
      {isStaff && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>工作人员</h2>
          <div className={styles.entries}>
            <Link className={styles.entry} to="/staff/claims">
              认领审核
            </Link>
            <Link className={styles.entry} to="/staff/tickets">
              工单处理
            </Link>
            {role === 'admin' && (
              <Link className={styles.entry} to="/admin/staff-applications">
                教职工审核
              </Link>
            )}
          </div>
        </section>
      )}
      <div className={styles.logout}>
        <Button variant="secondary" onClick={onLogout}>
          退出登录
        </Button>
      </div>
    </PageContainer>
  )
}