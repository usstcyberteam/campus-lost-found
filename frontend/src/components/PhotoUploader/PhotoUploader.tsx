import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { uploadPhoto } from '../../api/uploads'
import { errorMessage } from '../../utils/error'
import type { Photo } from '../../types'
import styles from './PhotoUploader.module.css'

const MAX_SIDE = 1600
const MAX_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

interface PhotoUploaderProps {
  photos: Photo[]
  onChange: (photos: Photo[]) => void
  max?: number
  disabled?: boolean
}

async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const longest = Math.max(bitmap.width, bitmap.height)
  if (longest <= MAX_SIDE && file.size <= MAX_BYTES) {
    bitmap.close()
    return file
  }
  const scale = Math.min(1, MAX_SIDE / longest)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    return file
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  return compressed ?? file
}

export default function PhotoUploader({ photos, onChange, max = 6, disabled = false }: PhotoUploaderProps) {
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const previewsRef = useRef(previews)
  previewsRef.current = previews

  useEffect(() => {
    return () => {
      Object.values(previewsRef.current).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  async function onSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return
    if (photos.length + files.length > max) {
      setError(`最多上传 ${max} 张照片`)
      return
    }
    setBusy(true)
    setError('')
    const next = [...photos]
    try {
      for (const file of files) {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          setError('仅支持 JPG、PNG、WebP 图片')
          continue
        }
        const blob = await compress(file)
        if (blob.size > MAX_BYTES) {
          setError('单张图片不能超过 5MB')
          continue
        }
        const uploaded = await uploadPhoto(new File([blob], file.name, { type: blob.type || file.type }))
        const preview = URL.createObjectURL(blob)
        setPreviews((current) => ({ ...current, [uploaded.id]: preview }))
        next.push(uploaded)
      }
      onChange(next)
    } catch (err) {
      setError(errorMessage(err, '上传失败，请重试'))
    } finally {
      setBusy(false)
    }
  }

  function remove(photo: Photo) {
    const preview = previews[photo.id]
    if (preview) {
      URL.revokeObjectURL(preview)
      setPreviews((current) => {
        const next = { ...current }
        delete next[photo.id]
        return next
      })
    }
    onChange(photos.filter((item) => item.id !== photo.id))
  }

  return (
    <div className={styles.uploader}>
      <ul className={styles.grid}>
        {photos.map((photo) => (
          <li key={photo.id} className={styles.item}>
            {previews[photo.id] && <img className={styles.image} src={previews[photo.id]} alt="已上传照片" />}
            <button
              type="button"
              className={styles.remove}
              aria-label="删除照片"
              disabled={disabled || busy}
              onClick={() => remove(photo)}
            >
              ×
            </button>
          </li>
        ))}
        {photos.length < max && (
          <li className={styles.item}>
            <label className={styles.add}>
              <input
                className={styles.input}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                aria-label="添加照片"
                disabled={disabled || busy}
                onChange={onSelect}
              />
              <span>{busy ? '上传中…' : '添加照片'}</span>
            </label>
          </li>
        )}
      </ul>
      <p className={styles.hint}>最多 {max} 张，单张不超过 5MB，长边超过 {MAX_SIDE}px 会自动压缩</p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}