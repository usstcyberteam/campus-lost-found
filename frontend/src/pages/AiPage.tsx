import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listBuildings } from '../api/buildings'
import { listItems } from '../api/items'
import { useSearchAdvice } from '../hooks/useSearchAdvice'
import {
  placeLabel,
  type AiChatResult,
  type Building,
  type DraftPost,
  type FormPatch,
  type Item,
  type SearchAdvice,
} from '../types'
import AiChat from '../components/AiChat/AiChat'
import BlobStudio from '../components/BlobStudio/BlobStudio'
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

const CAPABILITIES = [
  '把一句话描述整理成可发布的草稿',
  '根据历史记录推荐更可能找到的地点',
  '模型不可用时自动降级为规则整理，主流程不受影响',
]

export default function AiPage() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<DraftPost | null>(null)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [lostItems, setLostItems] = useState<Item[]>([])
  const [itemId, setItemId] = useState('')
  const [presetText, setPresetText] = useState<{ text: string; token: number } | null>(null)
  const { advice, error: adviceError, pending, request } = useSearchAdvice()
  const adviceRef = useRef<HTMLDivElement>(null)

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

  // form_patch 只填空字段：已填内容视为用户确认过，不覆盖。
  function applyPatch(patch: FormPatch, result: AiChatResult) {
    setDraft((prev) => {
      const base: DraftPost = prev ?? {
        category: null,
        title: null,
        description: null,
        location_area: null,
        building_code: null,
        floor: null,
        time_occurred: null,
        source: result.source,
        degraded: result.degraded,
      }
      const merged: DraftPost = { ...base }
      for (const key of ['category', 'title', 'description', 'location_area', 'building_code'] as const) {
        if (!base[key] && patch[key]) merged[key] = patch[key]
      }
      if (base.floor === null && patch.floor !== null) merged.floor = patch.floor
      if (!base.time_occurred && patch.time_occurred) merged.time_occurred = patch.time_occurred
      merged.source = result.source
      merged.degraded = result.degraded
      return merged
    })
  }

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

  // 快捷指令：降低“该问什么”的表达门槛
  function quickDraft() {
    setPresetText({ text: '今天下午在图书馆3楼丢了一把蓝色折叠伞，伞柄有磨损。', token: Date.now() })
  }

  function quickAdvice() {
    adviceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <PageContainer>
      <PageHeader title="AI 助手" />
      <div className={styles.page}>
        <section className={styles.welcome} aria-label="能力说明">
          <div className={styles.tape} aria-hidden="true">
            AI 书记员　在岗　AI 书记员　在岗　AI 书记员　在岗　AI 书记员　在岗
          </div>
          <h2 className={styles.welcomeTitle}>我是 AI 书记员，帮你更快立案、更快找到</h2>
          <ul className={styles.capabilities}>
            {CAPABILITIES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className={styles.actions} role="group" aria-label="快捷指令">
            <button type="button" className={styles.chip} onClick={quickDraft}>
              写一段发布文案
            </button>
            <button type="button" className={styles.chip} onClick={quickAdvice}>
              根据寻物帖推荐地点
            </button>
            <button type="button" className={styles.chip} onClick={goMap} disabled={!advice}>
              在地图查看推荐
            </button>
          </div>
        </section>

        <BlobStudio ariaLabel="可拖拽塑形的 AI 形态" />

        <Card>
          <AiChat onPatch={applyPatch} presetText={presetText} />
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
            <div className={styles.resultActions}>
              <Button onClick={goPublish}>应用到发布</Button>
              <Button
                variant="secondary"
                onClick={() => setPresetText({ text: draft.description ?? '', token: Date.now() })}
              >
                调整描述
              </Button>
            </div>
          </Card>
        )}

        <div ref={adviceRef}>
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
            {lostItems.length === 0 && (
              <p className={styles.note}>
                暂无寻物帖，可先<Link to="/publish">发布一条</Link>。
              </p>
            )}
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
                <div className={styles.resultActions}>
                  <Button variant="secondary" onClick={goMap}>
                    在地图查看推荐
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
        <p className={styles.note}>模型不可用时仍可手动发布、筛选和归还，不影响主流程。</p>
      </div>
    </PageContainer>
  )
}
