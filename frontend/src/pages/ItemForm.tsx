import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import client, { errorMessage } from '../api/client'
import type { Direction } from '../types'
import Button from '../components/ui/Button'
import TextInput from '../components/ui/TextInput'
import TextArea from '../components/ui/TextArea'
import Tag from '../components/ui/Tag'
import ErrorState from '../components/ui/ErrorState'
import styles from './ItemForm.module.css'

export default function ItemForm() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const presetDirection = searchParams.get('direction')

  const [direction, setDirection] = useState<Direction>(presetDirection === 'found' ? 'found' : 'lost')
  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [locationArea, setLocationArea] = useState('')
  const [preciseLocation, setPreciseLocation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await client.post('/items', {
        direction,
        category,
        title,
        description,
        location_area: locationArea,
        precise_location: preciseLocation || null,
      })
      navigate('/')
    } catch (error) { setError(errorMessage(error)) }
    finally { setBusy(false) }
  }

  return (
    <main className={`${styles.page} ${direction === 'lost' ? styles.lostTheme : styles.foundTheme}`}>
      <div className={styles.container}>
        <h1 className={styles.title}>发布信息</h1>

        <form onSubmit={onSubmit} className={styles.form}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>发布类型</h2>
            <div className={styles.typeCards}>
              <button
                type="button"
                className={`${styles.typeCard} ${direction === 'lost' ? styles.typeCardActive : ''}`}
                onClick={() => setDirection('lost')}
                aria-pressed={direction === 'lost'}
              >
                <Tag variant="coral">寻物</Tag>
                <span className={styles.typeDesc}>我丢了东西，需要帮助找回</span>
              </button>
              <button
                type="button"
                className={`${styles.typeCard} ${direction === 'found' ? styles.typeCardActive : ''}`}
                onClick={() => setDirection('found')}
                aria-pressed={direction === 'found'}
              >
                <Tag variant="mint">拾获</Tag>
                <span className={styles.typeDesc}>我捡到了东西，寻找失主</span>
              </button>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>物品信息</h2>
            <div className={styles.fields}>
              <TextInput
                label="类别"
                placeholder="如 雨伞、手机、钥匙"
                value={category}
                onChange={setCategory}
                required
              />
              <TextInput
                label="标题"
                placeholder="简要描述物品"
                value={title}
                onChange={setTitle}
                required
              />
              <TextArea
                label="描述"
                placeholder="详细描述物品特征、丢失/拾获经过等"
                value={description}
                onChange={setDescription}
              />
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>地点信息</h2>
            <div className={styles.fields}>
              <TextInput
                label="地点（楼层级）"
                placeholder="如 图书馆2F、教学楼A栋"
                value={locationArea}
                onChange={setLocationArea}
              />
              <TextInput
                label="精确位置（仅自己可见）"
                placeholder="如 3楼靠窗第5排"
                value={preciseLocation}
                onChange={setPreciseLocation}
              />
            </div>
          </section>

          {error && <ErrorState message={error} />}

          <div className={styles.submitArea}>
            <Button type="submit" variant="primary" size="lg" loading={busy}>
              {busy ? '发布中…' : '提交发布'}
            </Button>
          </div>
        </form>
      </div>
    </main>
  )
}
