import { useEffect, useRef, useState } from 'react'
import { listBuildings } from '../api/buildings'
import { listItems } from '../api/items'
import { useDebounce } from '../hooks/useDebounce'
import { errorMessage } from '../utils/error'
import { statusLabels, type Building, type Direction, type Item, type ItemStatus } from '../types'
import Button from '../components/Button'
import Empty from '../components/Empty'
import ErrorNotice from '../components/ErrorNotice'
import ItemCard from '../components/ItemCard/ItemCard'
import PageContainer from '../components/PageContainer'
import PageHeader from '../components/AppShell/PageHeader'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Spinner from '../components/Spinner'
import styles from './Hall.module.css'

const PAGE_SIZE = 20

export default function Hall() {
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

  return (
    <PageContainer>
      <PageHeader title="大厅" />
      <div className={styles.filters}>
        <Input aria-label="搜索关键词" placeholder="搜索标题、描述、类别" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select
          aria-label="类型"
          value={direction}
          onChange={(e) => setDirection(e.target.value as Direction | '')}
        >
          <option value="">全部类型</option>
          <option value="lost">寻物</option>
          <option value="found">拾获</option>
        </Select>
        <Input aria-label="类别" placeholder="类别" value={category} onChange={(e) => setCategory(e.target.value)} />
        <Select aria-label="状态" value={status} onChange={(e) => setStatus(e.target.value as ItemStatus | '')}>
          <option value="">全部状态</option>
          {Object.entries(statusLabels).map(([k, v]) => (
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
      {error && <ErrorNotice message={error} />}
      {loading && <Spinner />}
      {!loading && !error && items.length === 0 && <Empty text="暂无符合条件的记录" />}
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={styles.item}>
            <ItemCard item={item} />
          </li>
        ))}
      </ul>
      {!loading && items.length < total && (
        <div className={styles.more}>
          <Button variant="secondary" loading={loadingMore} onClick={loadMore}>
            {loadingMore ? '加载中…' : '加载更多'}
          </Button>
        </div>
      )}
    </PageContainer>
  )
}
