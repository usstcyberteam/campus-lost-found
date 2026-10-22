import { useEffect, useState } from 'react'
import { fetchPhotoUrl } from '../../api/uploads'
import type { Photo } from '../../types'
import styles from './PhotoGallery.module.css'

const EMPTY: Photo[] = []

interface PhotoGalleryProps {
  photos?: Photo[]
}

export default function PhotoGallery({ photos = EMPTY }: PhotoGalleryProps) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const created: string[] = []
    setUrls({})
    setError('')
    if (photos.length === 0) return
    Promise.all(
      photos.map(async (photo) => {
        const url = await fetchPhotoUrl(photo.url)
        if (!active) {
          URL.revokeObjectURL(url)
          return null
        }
        created.push(url)
        return [photo.id, url] as const
      }),
    )
      .then((entries) => {
        if (!active) return
        const valid = entries.filter((entry): entry is readonly [string, string] => entry !== null)
        setUrls(Object.fromEntries(valid))
      })
      .catch(() => {
        if (active) setError('照片加载失败')
      })
    return () => {
      active = false
      created.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [photos])

  if (photos.length === 0) return null

  return (
    <div className={styles.gallery}>
      <ul className={styles.grid}>
        {photos.map((photo, index) =>
          urls[photo.id] ? (
            <li key={photo.id} className={styles.item}>
              <img className={styles.image} src={urls[photo.id]} alt={`物品照片 ${index + 1}`} />
            </li>
          ) : null,
        )}
      </ul>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}