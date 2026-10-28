import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { errorMessage } from '../utils/error'
import {
  createItem,
  createRoute,
  getItem,
  setMapAnchor,
  updateItem,
  type CircleGeometry,
  type PolylineGeometry,
} from '../api/items'
import { useAsync } from '../hooks/useAsync'
import { aiChat, suggestLocations } from '../api/ai'
import { directionLabels, type Direction, type Item, type Photo, type RouteKind, type Visibility } from '../types'
import Button from '../components/Button'
import ErrorNotice from '../components/ErrorNotice'
import Field from '../components/Field'
import PageHeader from '../components/AppShell/PageHeader'
import PhotoUploader from '../components/PhotoUploader/PhotoUploader'
import Spinner from '../components/Spinner'
import Tag from '../components/Tag'
import styles from './ItemForm.module.css'

interface MapPublishState {
  direction?: Direction
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

interface FormErrors {
  category?: string
  title?: string
}

interface AiPrefill {
  direction?: 'lost' | 'found'
  category?: string | null
  title?: string | null
  description?: string | null
  location_area?: string | null
  time_occurred?: string | null
  floor?: number | null
}

/** 解析 URL query 中的 AI 预填数据（悬浮窗助手跳转带入）。数据源由调用方传入。 */
function parseAiPrefill(search: string): AiPrefill | null {
  try {
    const raw = new URLSearchParams(search).get('ai_prefill')
    if (!raw) return null
    const parsed = JSON.parse(raw) as AiPrefill
    if (parsed && typeof parsed === 'object') return parsed
    return null
  } catch {
    return null
  }
}

const CATEGORY_OPTIONS = ['雨伞', '水杯', '手机', '笔记本电脑', '耳机', '钱包', '校园卡', '钥匙', '书包', '其他']

export default function ItemForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const editing = Boolean(id)
  // 地图/AI 带入的预置数据仅在新建时生效，编辑时以服务端记录为准
  const preset = editing ? null : ((location.state as MapPublishState | null) ?? null)
  // 悬浮窗助手跳转带入的预填（URL query）；仅填空字段，不覆盖用户已手写内容
  const [aiExtra, setAiExtra] = useState<AiPrefill | null>(null)
  const geometry = preset?.geometry ?? null
  const routeKind = preset?.route_kind ?? null
  const {
    data: loaded,
    loading,
    error: loadError,
  } = useAsync<Item | null>(() => (id ? getItem(id) : Promise.resolve(null)), [id])
  const [direction, setDirection] = useState<Direction>(preset?.direction ?? 'lost')
  const [category, setCategory] = useState(preset?.category ?? '')
  const [title, setTitle] = useState(preset?.title ?? '')
  const [description, setDescription] = useState(preset?.description ?? '')
  const [locationArea, setLocationArea] = useState(preset?.location_area ?? '')
  const [preciseLocation, setPreciseLocation] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [visibility, setVisibility] = useState<Visibility>(preset?.visibility ?? 'private')
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [templateHint, setTemplateHint] = useState('')
  const [busy, setBusy] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [polishBusy, setPolishBusy] = useState(false)
  const [polishPreview, setPolishPreview] = useState<string | null>(null)
  // AI 预填交互：实际填入的字段 key（用于高亮）、顶部提示条可见性
  const [prefilledKeys, setPrefilledKeys] = useState<string[]>([])
  const [aiToastVisible, setAiToastVisible] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const scrollRaf = useRef(0)
  const highlightTimer = useRef(0)
  const toastTimer = useRef(0)

  // 地点输入框聚焦时按历史频次推荐：当前有输入则按关键词过滤，否则给全局热门
  async function onLocationFocus() {
    if (suggestions.length > 0 || editing) return
    try {
      const keyword = locationArea.trim() || undefined
      const locations = await suggestLocations(keyword)
      setSuggestions(locations.slice(0, 5))
    } catch {
      setSuggestions([])
    }
  }

  /** AI 润色：把表单字段拼成摘要发给 chat(action=polish)，结果先预览、用户点"采用"才写入。 */
  async function onPolishClick() {
    if (polishBusy) return
    if (!title.trim()) {
      setTemplateHint('先填写标题，再使用 AI 润色')
      return
    }
    setPolishBusy(true)
    setPolishPreview(null)
    setTemplateHint('')
    try {
      const lines = [
        `类型：${direction === 'lost' ? '丢失' : '拾获'}`,
        category.trim() ? `类别：${category.trim()}` : null,
        `标题：${title.trim()}`,
        locationArea.trim() ? `地点：${locationArea.trim()}` : null,
        aiExtra?.time_occurred ? `时间：${aiExtra.time_occurred}` : null,
        description.trim() ? `现有描述：${description.trim()}` : null,
      ].filter((line): line is string => line !== null)
      const result = await aiChat(lines.join('\n'), undefined, 'polish')
      const polished = result.form_patch?.description ?? result.reply
      setPolishPreview(polished)
    } catch (err) {
      setTemplateHint(errorMessage(err))
    } finally {
      setPolishBusy(false)
    }
  }

  useEffect(() => {
    if (!editing || !loaded) return
    setDirection(loaded.direction)
    setCategory(loaded.category)
    setTitle(loaded.title)
    setDescription(loaded.description ?? '')
    setLocationArea(loaded.location_area ?? '')
    setPreciseLocation(loaded.precise_location ?? '')
  }, [editing, loaded])

  // 悬浮窗助手预填：挂载或 query 变化时生效（同路径二次跳转组件不重挂，靠 search 变化触发）。
  // 数据源必须用 react-router 的 location.search（而非 window.location.search）：
  // StrictMode 双挂载时第一次 effect 的 replaceState 会清空地址栏，window 读源在第二次挂载
  // 读到空导致预填丢失；router 状态不受 replaceState 影响，两次挂载均能解析（填充幂等）。
  // 只填空字段：字段已有内容（用户手写或地图带入）一律不覆盖。
  useEffect(() => {
    if (editing) return
    const parsed = parseAiPrefill(location.search)
    if (!parsed) return
    console.log('[AiPrefill] parsing prefill from query:', location.search.slice(0, 80))
    // 类型仅在与地图带入数据不冲突且表单仍空白时同步，避免覆盖用户已选内容
    const blank = !category && !title && !locationArea
    // 逐字段记录"本次实际写入"的 key，只高亮 AI 真正填入的字段
    const filled: string[] = []
    if (blank && parsed.direction === 'found' && !preset) {
      setDirection('found')
      filled.push('direction')
    }
    if (!category && parsed.category) {
      setCategory(parsed.category)
      filled.push('category')
    }
    if (!title && parsed.title) {
      setTitle(parsed.title)
      filled.push('title')
    }
    if (!description && parsed.description) {
      setDescription(parsed.description)
      filled.push('description')
    }
    if (!locationArea && parsed.location_area) {
      setLocationArea(parsed.location_area)
      filled.push('locationArea')
    }
    setAiExtra(parsed)
    console.log('[AiPrefill] filled fields:', filled)
    // 只清地址栏显示（防刷新/分享重复预填）；router 状态保持，effect 不因 deps 变化重跑
    window.history.replaceState(null, '', window.location.pathname)
    if (filled.length === 0) return
    // 预填生效：高亮 2.5s 渐隐 + 顶部提示条 3s 自动消失 + 平滑滚动到表单区
    setPrefilledKeys(filled)
    setAiToastVisible(true)
    scrollRaf.current = window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    window.clearTimeout(highlightTimer.current)
    highlightTimer.current = window.setTimeout(() => setPrefilledKeys([]), 2500)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setAiToastVisible(false), 3000)
    return () => {
      window.cancelAnimationFrame(scrollRaf.current)
      window.clearTimeout(highlightTimer.current)
      window.clearTimeout(toastTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, location.search])

  function applyTemplate(kind: 'short' | 'long' | 'place') {
    if (kind === 'short') {
      if (!description) setDescription('简要描述物品特征，以及丢失/拾获的时间与经过。')
      setTemplateHint('已套用「短动态」模板')
    } else if (kind === 'long') {
      if (!description) setDescription('物品特征：\n时间地点：\n其他线索：')
      setTemplateHint('已套用「长文」模板')
    } else {
      if (!locationArea) setLocationArea('图书馆2F')
      setTemplateHint('已套用「带地点」模板')
    }
  }

  function validate(): boolean {
    const next: FormErrors = {}
    if (!category.trim()) next.category = '请填写或选择类别'
    if (!title.trim()) next.title = '请填写标题'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (createdId) {
      navigate('/hall')
      return
    }
    if (!validate()) return
    setBusy(true)
    setError('')
    try {
      if (editing && id) {
        await updateItem(id, {
          category,
          title,
          description,
          location_area: locationArea,
          precise_location: preciseLocation || null,
        })
        navigate(`/hall/${id}`)
        return
      }
      const item = await createItem({
        direction,
        category,
        title,
        description,
        location_area: locationArea,
        precise_location: preciseLocation || null,
        time_occurred: preset?.time_occurred ?? aiExtra?.time_occurred ?? null,
        building_id: preset?.building_id ?? null,
        floor: preset?.floor ?? aiExtra?.floor ?? null,
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

  if (editing && loading) {
    return (
      <div className={styles.container}>
        <PageHeader title="编辑" backTo={id ? `/hall/${id}` : '/hall'} />
        <Spinner />
      </div>
    )
  }
  if (editing && loadError) {
    return (
      <div className={styles.container}>
        <PageHeader title="编辑" backTo={id ? `/hall/${id}` : '/hall'} />
        <ErrorNotice message={loadError} />
      </div>
    )
  }

  const previewLocation = locationArea.trim() || preset?.location_area || '未指定地点'
  const isPrefilled = (key: string) => prefilledKeys.includes(key)

  return (
    <div className={styles.container}>
      <PageHeader title={editing ? '编辑' : '发布'} backTo={editing && id ? `/hall/${id}` : '/hall'} />
      {!editing && aiToastVisible && (
        <div className={styles.aiToast} role="status">
          <span>✨ AI 已为你预填信息，确认后提交即可</span>
          <button
            type="button"
            className={styles.aiToastClose}
            aria-label="关闭提示"
            onClick={() => setAiToastVisible(false)}
          >
            ×
          </button>
        </div>
      )}
      {editing ? (
        <p className={styles.notice}>正在编辑这条记录，修改后保存。状态与已上传照片不受影响。</p>
      ) : preset?.from_ai || aiExtra ? (
        <p className={styles.notice}>已带入 AI 整理草稿，请确认或修改后发布。</p>
      ) : (
        preset && (
          <p className={styles.notice}>
            已从地图带入{preset.building_name ? `建筑「${preset.building_name}」` : '位置'}
            {geometry ? '与绘制范围' : ''}。
          </p>
        )
      )}

      <div className={styles.layout}>
        <form id="item-form" className={styles.form} onSubmit={onSubmit} ref={formRef}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>基本信息</h2>
            <div className={isPrefilled('direction') ? styles.fieldPrefilled : undefined}>
              <Field label="类型">
                <div className={styles.chips} role="group" aria-label="类型">
                  <button
                    type="button"
                    className={`${styles.chip} ${direction === 'lost' ? styles.chipActive : ''}`}
                    aria-pressed={direction === 'lost'}
                    disabled={editing}
                    onClick={() => setDirection('lost')}
                  >
                    寻物
                  </button>
                  <button
                    type="button"
                    className={`${styles.chip} ${direction === 'found' ? styles.chipActive : ''}`}
                    aria-pressed={direction === 'found'}
                    disabled={editing}
                    onClick={() => setDirection('found')}
                  >
                    拾获
                  </button>
                </div>
              </Field>
            </div>
            <div className={isPrefilled('category') ? styles.fieldPrefilled : undefined}>
              <Field label="类别" htmlFor="item-category" required error={errors.category}>
                <div className={styles.chips} role="group" aria-label="常用类别">
                  {CATEGORY_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`${styles.chip} ${category === option ? styles.chipActive : ''}`}
                      aria-pressed={category === option}
                      onClick={() => {
                        setCategory(option)
                        setErrors((current) => ({ ...current, category: undefined }))
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <input
                  id="item-category"
                  aria-label="类别"
                  placeholder="或自定义类别"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value)
                    setErrors((current) => ({ ...current, category: undefined }))
                  }}
                />
              </Field>
            </div>
            <div className={isPrefilled('title') ? styles.fieldPrefilled : undefined}>
              <Field label="标题" htmlFor="item-title" required error={errors.title}>
                <input
                  id="item-title"
                  aria-label="标题"
                  placeholder="标题"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    setErrors((current) => ({ ...current, title: undefined }))
                  }}
                />
              </Field>
            </div>
            <div className={isPrefilled('description') ? styles.fieldPrefilled : undefined}>
              <Field label="描述" htmlFor="item-description">
                <textarea
                  id="item-description"
                  aria-label="描述"
                  placeholder="描述"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
            </div>
            <div className={styles.polishBlock}>
              <button
                type="button"
                className={styles.polishButton}
                onClick={onPolishClick}
                disabled={polishBusy || !title.trim()}
              >
                {polishBusy ? '润色中…' : '✨ AI 润色描述'}
              </button>
              {polishPreview !== null && (
                <div className={styles.polishPreview}>
                  <p className={styles.polishText}>{polishPreview}</p>
                  <div className={styles.polishActions}>
                    <button
                      type="button"
                      className={styles.polishApply}
                      onClick={() => {
                        setDescription(polishPreview)
                        setPolishPreview(null)
                        setTemplateHint('已采用 AI 润色描述，可继续修改')
                      }}
                    >
                      {description.trim() ? '替换现有描述' : '采用'}
                    </button>
                    <button type="button" className={styles.polishDiscard} onClick={() => setPolishPreview(null)}>
                      放弃
                    </button>
                  </div>
                </div>
              )}
            </div>
            {!editing && (
              <div className={styles.templates}>
                <span className={styles.templatesLabel}>快捷模板</span>
                <div className={styles.chips}>
                  <button type="button" className={styles.chip} onClick={() => applyTemplate('short')}>
                    短动态
                  </button>
                  <button type="button" className={styles.chip} onClick={() => applyTemplate('long')}>
                    长文
                  </button>
                  <button type="button" className={styles.chip} onClick={() => applyTemplate('place')}>
                    带地点
                  </button>
                </div>
                {templateHint && <span className={styles.note}>{templateHint}</span>}
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>地点与时间</h2>
            <div className={isPrefilled('locationArea') ? styles.fieldPrefilled : undefined}>
              <Field label="地点" htmlFor="item-location">
                <input
                  id="item-location"
                  aria-label="地点"
                  placeholder="地点（楼层级，如 图书馆2F）"
                  value={locationArea}
                  onChange={(e) => setLocationArea(e.target.value)}
                  onFocus={onLocationFocus}
                />
                {suggestions.length > 0 && (
                  <div className={styles.locationSuggestions} role="listbox" aria-label="推荐地点">
                    {suggestions.map((area) => (
                      <button
                        key={area}
                        type="button"
                        className={styles.locationChip}
                        role="option"
                        aria-selected={area === locationArea}
                        onClick={() => {
                          setLocationArea(area)
                          setSuggestions([])
                        }}
                      >
                        {area}
                      </button>
                    ))}
                  </div>
                )}
              </Field>
            </div>
            <Field label="精确位置" htmlFor="item-precise">
              <input
                id="item-precise"
                aria-label="精确位置"
                placeholder="精确位置（仅自己可见）"
                value={preciseLocation}
                onChange={(e) => setPreciseLocation(e.target.value)}
              />
            </Field>
          </section>

          {!editing && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>照片</h2>
              <PhotoUploader photos={photos} onChange={setPhotos} disabled={busy} />
            </section>
          )}

          {!editing && geometry && routeKind && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>隐私</h2>
              <Field label="路线可见性">
                <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
                  <option value="private">私密（仅自己与已授权处理人员）</option>
                  <option value="public">公开</option>
                </select>
                <span className={styles.note}>圈选默认公开，路径默认私密</span>
              </Field>
            </section>
          )}

          {error && <ErrorNotice message={error} />}
        </form>

        <aside className={styles.preview} aria-label="实时预览">
          <h2 className={styles.previewTitle}>实时预览</h2>
          <article className={styles.previewCard}>
            <div className={styles.previewTags}>
              <Tag tone={direction}>{directionLabels[direction]}</Tag>
              <span className={styles.previewCategory}>{category || '未填写类别'}</span>
            </div>
            <h3 className={styles.previewHeading}>{title || '未填写标题'}</h3>
            <p className={styles.previewDesc}>{description || '暂无描述'}</p>
            <p className={styles.previewMeta}>地点：{previewLocation}</p>
            {!editing && geometry && routeKind && (
              <p className={styles.previewMeta}>路线可见性：{visibility === 'public' ? '公开' : '私密'}</p>
            )}
          </article>
          <p className={styles.note}>发布前即可确认他人看到的内容。</p>
        </aside>
      </div>

      <div className={styles.footer}>
        <Button type="submit" form="item-form" loading={busy}>
          {editing ? (busy ? '保存中…' : '保存修改') : createdId ? '前往大厅' : busy ? '发布中…' : '发布'}
        </Button>
      </div>
    </div>
  )
}
