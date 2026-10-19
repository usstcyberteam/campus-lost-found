import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { errorMessage } from '../utils/error'
import {
  createItem,
  createRoute,
  setMapAnchor,
  type CircleGeometry,
  type PolylineGeometry,
} from '../api/items'
import type { Direction, Photo, RouteKind, Visibility } from '../types'
import Button from '../components/Button'
import ErrorNotice from '../components/ErrorNotice'
import Field from '../components/Field'
import PageHeader from '../components/AppShell/PageHeader'
import PhotoUploader from '../components/PhotoUploader/PhotoUploader'
import styles from './ItemForm.module.css'

interface MapPublishState {
  building_id?: string | null
  building_name?: string | null
  floor?: number | null
  category?: string | null
  title?: string | null
  description?: string | null
  time_occurred?: string | null
  from_ai?: boolean
  location_area?: string
  layer_id?: string
  norm_x?: number
  norm_y?: number
  geometry?: CircleGeometry | PolylineGeometry | null
  route_kind?: RouteKind | null
  visibility?: Visibility
}

export default function ItemForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const preset = (location.state as MapPublishState | null) ?? null
  const geometry = preset?.geometry ?? null
  const routeKind = preset?.route_kind ?? null
  const [direction, setDirection] = useState<Direction>('lost')
  const [category, setCategory] = useState(preset?.category ?? '')
  const [title, setTitle] = useState(preset?.title ?? '')
  const [description, setDescription] = useState(preset?.description ?? '')
  const [locationArea, setLocationArea] = useState(preset?.location_area ?? '')
  const [preciseLocation, setPreciseLocation] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [visibility, setVisibility] = useState<Visibility>(preset?.visibility ?? 'private')
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (createdId) {
      navigate('/hall')
      return
    }
    setBusy(true)
    setError('')
    try {
      const item = await createItem({
        direction,
        category,
        title,
        description,
        location_area: locationArea,
        precise_location: preciseLocation || null,
        time_occurred: preset?.time_occurred ?? null,
        building_id: preset?.building_id ?? null,
        floor: preset?.floor ?? null,
        photo_ids: photos.map((photo) => photo.id),
      })
      setCreatedId(item.id)
      if (preset?.layer_id && preset.norm_x != null && preset.norm_y != null) {
        await setMapAnchor(item.id, {
          layer_id: preset.layer_id,
          norm_x: preset.norm_x,
          norm_y: preset.norm_y,
        })
      }
      if (geometry && routeKind) {
        await createRoute(item.id, {
          kind: routeKind,
          layer_id: preset?.layer_id ?? null,
          geometry,
          visibility,
        })
      }
      navigate('/hall')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.container}>
      <PageHeader title="发布" backTo="/hall" />
      {preset?.from_ai ? (
        <p className={styles.notice}>已带入 AI 整理草稿，请确认或修改后发布。</p>
      ) : (
        preset && (
          <p className={styles.notice}>
            已从地图带入{preset.building_name ? `建筑「${preset.building_name}」` : '位置'}
            {geometry ? '与绘制范围' : ''}。
          </p>
        )
      )}
      <form onSubmit={onSubmit} className={styles.form}>
        <Field label="类型">
          <select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
            <option value="lost">寻物</option>
            <option value="found">拾获</option>
          </select>
        </Field>
        <Field label="类别">
          <input
            placeholder="类别（如 雨伞）"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          />
        </Field>
        <Field label="标题">
          <input placeholder="标题" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Field>
        <Field label="描述">
          <textarea placeholder="描述" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="地点">
          <input
            placeholder="地点（楼层级，如 图书馆2F）"
            value={locationArea}
            onChange={(e) => setLocationArea(e.target.value)}
          />
        </Field>
        <Field label="精确位置">
          <input
            placeholder="精确位置（仅自己可见）"
            value={preciseLocation}
            onChange={(e) => setPreciseLocation(e.target.value)}
          />
        </Field>
        {geometry && routeKind && (
          <Field label="路线可见性">
            <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
              <option value="private">私密（仅自己与已授权处理人员）</option>
              <option value="public">公开</option>
            </select>
            <span className={styles.note}>圈选默认公开，路径默认私密</span>
          </Field>
        )}
        {error && <ErrorNotice message={error} />}
        <PhotoUploader photos={photos} onChange={setPhotos} disabled={busy} />
        <Button type="submit" loading={busy}>
          {createdId ? '前往大厅' : busy ? '发布中…' : '提交'}
        </Button>
      </form>
    </div>
  )
}
