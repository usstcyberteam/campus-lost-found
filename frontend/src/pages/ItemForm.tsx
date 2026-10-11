import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import client, { errorMessage } from '../api/client'
import type { Direction } from '../types'

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
      await client.post('/items', {
        direction,
        category,
        title,
        description,
        location_area: locationArea,
        precise_location: preciseLocation || null,
      })
      navigate('/')
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '24px auto', padding: 24 }}>
      <h1>发布</h1>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <div>
          <label>类型</label>
          <select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
            <option value="lost">寻物</option>
            <option value="found">拾获</option>
          </select>
        </div>
        <input placeholder="类别（如 雨伞）" value={category} onChange={(e) => setCategory(e.target.value)} required />
        <input placeholder="标题" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <textarea placeholder="描述" value={description} onChange={(e) => setDescription(e.target.value)} />
        <input
          placeholder="地点（楼层级，如 图书馆2F）"
          value={locationArea}
          onChange={(e) => setLocationArea(e.target.value)}
        />
        <input
          placeholder="精确位置（仅自己可见）"
          value={preciseLocation}
          onChange={(e) => setPreciseLocation(e.target.value)}
        />
        {error && <p style={{ color: '#dc2626' }}>{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? '发布中…' : '提交'}
        </button>
      </form>
    </div>
  )
}
