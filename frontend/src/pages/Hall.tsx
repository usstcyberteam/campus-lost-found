import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listBuildings } from '../api/buildings'
import { listItems } from '../api/items'
import { useDebounce } from '../hooks/useDebounce'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../utils/error'
import { statusLabels, type Building, type Direction, type Item, type ItemStatus } from '../types'
import Button from '../components/Button'
import ErrorNotice from '../components/ErrorNotice'
import ItemGroup from '../components/ItemCard/ItemGroup'
import PageContainer from '../components/PageContainer'
import PageHeader from '../components/AppShell/PageHeader'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Spinner from '../components/Spinner'
import styles from './Hall.module.css'

const PAGE_SIZE = 20
const QUICK_CATEGORIES = ['雨伞', '水杯', '手机', '校园卡', '钥匙']

interface ItemCluster {
  primary: Item
  siblings: Item[]
}

// 相似帖聚类：组首帖保持原位，同组其余帖折叠到首帖下（group_id 由后端发布时规则判定）
function clusterByGroup(items: Item[]): ItemCluster[] {
  const clusters: ItemCluster[] = []
  const index = new Map<string, number>()
  for (const item of items) {
    if (item.group_id && index.has(item.group_id)) {
      clusters[index.get(item.group_id) as number].siblings.push(item)
    } else {
      if (item.group_id) index.set(item.group_id, clusters.length)
      clusters.push({ primary: item, siblings: [] })
    }
  }
  return clusters
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

export default function Hall() {
  const navigate = useNavigate()
  const { displayName } = useAuth()
  // 首次进入的 AI 能力轻引导：localStorage 标记关闭后不再出现
  const [aiGuideOpen, setAiGuideOpen] = useState(() => {
    try {
      return !localStorage.getItem('ai_guide_dismissed')
    } catch {
      return false
    }
  })
  const [direction, setDirection] = useState<Direction | ''>('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState<ItemStatus | ''>('')
  const [buildingId, setBuildingId] = useState('')
  const [q, setQ] = useState('')
  const [buildings, setBuildings] = useState<Building[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const seqRef = useRef(0)
  const debouncedQ = useDebounce(q, 300)
  const debouncedCategory = useDebounce(category, 300)

  useEffect(() => {
    listBuildings({ limit: 100 })
      .then((page) => setBuildings(page.items))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const seq = ++seqRef.current
    setLoading(true)
    setError('')
    listItems({
      direction: direction || null,
      category: debouncedCategory || null,
      status: status || null,
      q: debouncedQ || null,
      building_id: buildingId || null,
      limit: PAGE_SIZE,
      offset: 0,
    })
      .then((page) => {
        if (seq !== seqRef.current) return
        setItems(page.items)
        setTotal(page.total)
      })
      .catch((e) => {
        if (seq === seqRef.current) setError(errorMessage(e))
      })
      .finally(() => {
        if (seq === seqRef.current) setLoading(false)
      })
  }, [direction, debouncedCategory, status, debouncedQ, buildingId])

  async function loadMore() {
    if (loadingMore) return
    setLoadingMore(true)
    setError('')
    try {
      const page = await listItems({
        direction: direction || null,
        category: debouncedCategory || null,
        status: status || null,
        q: debouncedQ || null,
        building_id: buildingId || null,
        limit: PAGE_SIZE,
        offset: items.length,
      })
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id))
        return [...current, ...page.items.filter((item) => !seen.has(item.id))]
      })
      setTotal(page.total)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoadingMore(false)
    }
  }

  // 逻辑分组：按寻物 / 失物招领分隔，避免一条无边界的信息流；组内再做相似帖聚类
  const groups = useMemo(() => {
    const lost = clusterByGroup(items.filter((item) => item.direction === 'lost'))
    const found = clusterByGroup(items.filter((item) => item.direction === 'found'))
    return [
      { key: 'lost', title: '寻物启事', clusters: lost },
      { key: 'found', title: '失物招领', clusters: found },
    ].filter((group) => group.clusters.length > 0)
  }, [items])

  return (
    <PageContainer>
      <PageHeader title="大厅" />

      <section className={styles.hero} aria-label="问候">
        <h2 className={styles.heroTitle}>
          {greeting()}，{displayName || '同学'}
        </h2>
        <p className={styles.heroSub}>看看大家都在找什么、捡到了什么</p>
      </section>

      {aiGuideOpen && (
        <aside className={styles.aiGuide} aria-label="AI 功能引导">
          <p className={styles.aiGuideText}>
            AI 助手已上线：侧边悬浮条可<span className={styles.aiGuideKey}>对话找物</span>
            （支持语音）、发布页可<span className={styles.aiGuideKey}>一键润色描述</span>
            ，相似帖子自动聚合展示，有匹配结果会推送通知（底部"我的"显示未读数）。
          </p>
          <button
            type="button"
            className={styles.aiGuideClose}
            onClick={() => {
              try {
                localStorage.setItem('ai_guide_dismissed', '1')
              } catch {
                /* 隐私模式下写失败也不影响当次关闭 */
              }
              setAiGuideOpen(false)
            }}
          >
            知道了
          </button>
        </aside>
      )}

      <div className={styles.searchBar}>
        <Input
          aria-label="搜索关键词"
          placeholder="搜索标题、描述、类别"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className={styles.chipsRow} role="group" aria-label="快速入口">
          {[
            { key: '', label: '全部类型' },
            { key: 'lost', label: '寻物' },
            { key: 'found', label: '拾获' },
          ].map((chip) => (
            <button
              key={chip.key || 'all'}
              type="button"
              className={`${styles.chip} ${direction === chip.key ? styles.chipActive : ''}`}
              aria-pressed={direction === chip.key}
              onClick={() => setDirection(chip.key as Direction | '')}
            >
              {chip.label}
            </button>
          ))}
          <span className={styles.chipDivider} aria-hidden="true" />
          {QUICK_CATEGORIES.map((option) => (
            <button
              key={option}
              type="button"
              className={`${styles.chip} ${category === option ? styles.chipActive : ''}`}
              aria-pressed={category === option}
              onClick={() => setCategory(category === option ? '' : option)}
            >
              {option}
            </button>
          ))}
        </div>
        <div className={styles.filters}>
          <Input aria-label="类别" placeholder="类别" value={category} onChange={(e) => setCategory(e.target.value)} />
          <Select aria-label="状态" value={status} onChange={(e) => setStatus(e.target.value as ItemStatus | '')}>
            <option value="">全部状态</option>
            {Object.entries(statusLabels)
              .filter(([k]) => k !== 'deleted')
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </Select>
          <Select aria-label="建筑" value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
            <option value="">全部建筑</option>
            {buildings.map((building) => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error && <ErrorNotice message={error} />}
      {loading && <Spinner />}
      {!loading && !error && items.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyText}>没有符合条件的记录，换个筛选试试，或者主动发起一条。</p>
          <div className={styles.emptyActions}>
            <Button onClick={() => navigate('/publish')}>发布第一条</Button>
            <Button variant="secondary" onClick={() => navigate('/map')}>
              去地图看看
            </Button>
          </div>
        </div>
      )}

      {!loading &&
        groups.map((group) => (
          <section key={group.key} className={styles.group} aria-label={group.title}>
            <h2 className={styles.groupTitle}>
              {group.title}
              <span className={styles.groupCount}>{group.clusters.length}</span>
            </h2>
            <ul className={styles.list}>
              {group.clusters.map((cluster) => (
                <li key={cluster.primary.id} className={styles.item}>
                  <ItemGroup item={cluster.primary} siblings={cluster.siblings} />
                </li>
              ))}
            </ul>
          </section>
        ))}

      {!loading && items.length < total && (
        <div className={styles.more}>
          <Button variant="secondary" loading={loadingMore} onClick={loadMore}>
            {loadingMore ? '加载中…' : '加载更多'}
          </Button>
        </div>
      )}
      {!loading && items.length > 0 && <p className={styles.footNote}>已显示 {items.length} / {total} 条</p>}
    </PageContainer>
  )
}