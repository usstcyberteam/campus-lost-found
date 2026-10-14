import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage } from '../utils/error'
import { createItem } from '../api/items'
import type { Direction } from '../types'
import Button from '../components/Button'
import ErrorNotice from '../components/ErrorNotice'
import Field from '../components/Field'
import styles from './ItemForm.module.css'

export default function ItemForm() {
  const navigate = useNavigate()
  const [direction, setDirection] = useState<Direction>('lost')
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
      await createItem({
        direction,
        category,
        title,
        description,
        location_area: locationArea,
        precise_location: preciseLocation || null,
      })
      navigate('/')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.container}>
      <h1>发布</h1>
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
        {error && <ErrorNotice message={error} />}
        <Button type="submit" loading={busy}>
          {busy ? '发布中…' : '提交'}
        </Button>
      </form>
    </div>
  )
}
