import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listBuildings } from '../api/buildings'
import { listItems } from '../api/items'
import { useSearchAdvice } from '../hooks/useSearchAdvice'
import { placeLabel, type Building, type DraftPost, type Item, type SearchAdvice } from '../types'
import AiChat from '../components/AiChat/AiChat'
import Button from '../components/Button'
import Card from '../components/Card'
import ErrorNotice from '../components/ErrorNotice'
import PageContainer from '../components/PageContainer'
import PageHeader from '../components/AppShell/PageHeader'
import Tag from '../components/Tag'
import styles from './AiPage.module.css'

function formatTime(value: string | null): string {
  if (!value) return '待补充'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN')
}

function adviceSourceLabel(advice: SearchAdvice): string {
  return advice.source === 'model' && !advice.degraded ? '实时模型' : '规则推荐'
}

export default function AiPage() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<DraftPost | null>(null)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [lostItems, setLostItems] = useState<Item[]>([])
  const [itemId, setItemId] = useState('')
  const { advice, error: adviceError, pending, request } = useSearchAdvice()

  useEffect(() => {
    Promise.all([listBuildings({ limit: 100 }), listItems({ direction: 'lost', limit: 50 })])
      .then(([buildingPage, itemPage]) => {
        setBuildings(buildingPage.items)
        setLostItems(itemPage.items)
      })
      .catch(() => {})
  }, [])

  const building = draft?.building_code ? buildings.find((row) => row.code === draft.building_code) : undefined
  const buildingName = draft?.building_code ? (building?.name ?? draft.building_code) : '待补充'

  function goPublish() {
    if (!draft) return
    navigate('/publish', {
      state: {
        category: draft.category,
        title: draft.title,
        description: draft.description,
        location_area: draft.location_area,
        time_occurred: draft.time_occurred,
        floor: draft.floor,
        building_id: building?.id ?? null,
        building_name: building?.name ?? null,
        from_ai: true,
      },
    })
  }

  async function recommend() {
    if (!itemId) return
    await request({ item_id: itemId })
  }

  function goMap() {
    if (advice) navigate('/map', { state: { advice } })
  }

  return (
    <PageContainer>
      <PageHeader title="AI 助手" />
      <div className={styles.page}>
        <Card>
          <AiChat onDraft={setDraft} />
        </Card>
        {draft && (
          <Card className={styles.draft}>
            <div className={styles.draftHeader}>
              <h2 className={styles.draftTitle}>整理结果</h2>
              <Tag tone={draft.degraded ? 'warning' : 'primary'}>{draft.degraded ? '规则整理' : '实时模型'}</Tag>
            </div>
            <p className={styles.disclaimer}>AI 生成，仅供参考，请确认后发布。</p>
            <dl className={styles.fields}>
              <div className={styles.field}>
                <dt>类别</dt>
                <dd>{draft.category ?? '待补充'}</dd>
              </div>
              <div className={styles.field}>
                <dt>标题</dt>
                <dd>{draft.title ?? '待补充'}</dd>
              </div>
              <div className={styles.field}>
                <dt>描述</dt>
                <dd>{draft.description ?? '待补充'}</dd>
              </div>
              <div className={styles.field}>
                <dt>地点</dt>
                <dd>{draft.location_area ?? '待补充'}</dd>
              </div>
              <div className={styles.field}>
                <dt>建筑</dt>
                <dd>{buildingName}</dd>
              </div>
              <div className={styles.field}>
                <dt>时间</dt>
                <dd>{formatTime(draft.time_occurred)}</dd>
              </div>
            </dl>
            <Button onClick={goPublish}>去发布</Button>
          </Card>
        )}
        <Card className={styles.draft}>
          <div className={styles.draftHeader}>
            <h2 className={styles.draftTitle}>寻物地点推荐</h2>
            <Tag tone={advice?.source === 'model' && !advice.degraded ? 'primary' : 'warning'}>
              {advice ? adviceSourceLabel(advice) : '未生成'}
            </Tag>
          </div>
          <label className={styles.selectLabel}>
            选择一条寻物帖
            <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="">请选择</option>
              {lostItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} · {placeLabel(item)}
                </option>
              ))}
            </select>
          </label>
          {lostItems.length === 0 && <p className={styles.note}>暂无寻物帖，可先到大厅发布。</p>}
          <Button onClick={recommend} disabled={!itemId} loading={pending}>
            生成推荐
          </Button>
          {adviceError && <ErrorNotice message={adviceError} />}
          {advice && (
            <>
              <p className={styles.disclaimer}>AI 生成，仅供参考，请结合作业现场判断。</p>
              <ol className={styles.locations}>
                {advice.locations.map((location) => (
                  <li key={location.building_code}>
                    <strong>{location.building_name}</strong>
                    <p>{location.reason}</p>
                  </li>
                ))}
              </ol>
              <Button variant="secondary" onClick={goMap}>
                在地图查看
              </Button>
            </>
          )}
        </Card>
        <p className={styles.note}>模型不可用时仍可手动发布、筛选和归还，不影响主流程。</p>
      </div>
    </PageContainer>
  )
}