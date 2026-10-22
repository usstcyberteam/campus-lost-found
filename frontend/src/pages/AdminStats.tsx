import { Navigate } from 'react-router-dom'
import { getStats } from '../api/admin'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../auth/AuthContext'
import { statusLabels, type AdminStats as StatsData, type StatCount } from '../types'
import Card from '../components/ui/Card'
import ErrorState from '../components/ui/ErrorState'
import LoadingState from '../components/ui/LoadingState'
import PageContainer from '../components/PageContainer'
import PageHeader from '../components/AppShell/PageHeader'
import styles from './AdminStats.module.css'

function StatBars({ rows, label }: { rows: StatCount[]; label?: (row: StatCount) => string }) {
  const max = rows.reduce((best, row) => Math.max(best, row.count), 0)
  if (rows.length === 0) return <p className={styles.empty}>暂无数据</p>
  return (
    <div className={styles.bars}>
      {rows.map((row) => (
        <div key={row.key} className={styles.barRow}>
          <span className={styles.barLabel}>{label ? label(row) : row.name}</span>
          <span className={styles.barTrack}>
            <span
              className={styles.barFill}
              style={{ width: max > 0 ? `${Math.max((row.count / max) * 100, row.count > 0 ? 4 : 0)}%` : '0%' }}
            />
          </span>
          <span className={styles.barValue}>{row.count}</span>
        </div>
      ))}
    </div>
  )
}

function Metric({ title, value, hint }: { title: string; value: string | number; hint?: string }) {
  return (
    <Card className={styles.metric}>
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.metricTitle}>{title}</span>
      {hint && <span className={styles.metricHint}>{hint}</span>}
    </Card>
  )
}

export default function AdminStats() {
  const { role } = useAuth()
  const { data, loading, error, reload } = useAsync<StatsData>(() => getStats(), [])

  if (role !== 'admin') return <Navigate to="/hall" replace />

  return (
    <PageContainer>
      <PageHeader title="数据统计" backTo="/me" />
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <>
          <div className={styles.grid}>
            <Metric title="总记录" value={data.total_items} />
            <Metric title="寻物" value={data.lost_count} />
            <Metric title="拾获" value={data.found_count} />
            <Metric title="进行中" value={data.active_count} />
            <Metric title="已归还" value={data.returned_count} />
            <Metric title="找回率" value={`${(data.recovery_rate * 100).toFixed(1)}%`} hint="已归还 / 寻物总数" />
            <Metric
              title="平均处理时长"
              value={data.avg_handling_hours == null ? '—' : `${data.avg_handling_hours}h`}
              hint="已归还记录 发布→更新"
            />
            <Metric title="认领申请" value={data.claim_total} hint={`待审 ${data.claim_pending}`} />
          </div>

          <Card className={styles.block}>
            <h2 className={styles.blockTitle}>按状态分布</h2>
            <StatBars rows={data.by_status} label={(row) => statusLabels[row.key as keyof typeof statusLabels] ?? row.name} />
          </Card>

          <Card className={styles.block}>
            <h2 className={styles.blockTitle}>按类别分布</h2>
            <StatBars rows={data.by_category} />
          </Card>

          <Card className={styles.block}>
            <h2 className={styles.blockTitle}>按建筑分布</h2>
            <StatBars rows={data.by_building} />
          </Card>
        </>
      )}
    </PageContainer>
  )
}