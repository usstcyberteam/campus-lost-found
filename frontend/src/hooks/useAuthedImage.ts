import { useEffect, useState } from 'react'
import { fetchPhotoUrl } from '../api/uploads'

// 同一地址只拉取一次：头像会在评论、协助者列表里重复出现
const cache = new Map<string, Promise<string>>()

/** 需要登录态的图片（头像等）：带令牌拉取后转成本地对象 URL；地址为空或失败时返回空串。 */
export function useAuthedImage(url: string | null | undefined): string {
  const [src, setSrc] = useState('')

  useEffect(() => {
    if (!url) {
      setSrc('')
      return
    }
    let active = true
    let pending = cache.get(url)
    if (!pending) {
      pending = fetchPhotoUrl(url)
      cache.set(url, pending)
      pending.catch(() => cache.delete(url))
    }
    pending.then((objectUrl) => active && setSrc(objectUrl)).catch(() => active && setSrc(''))
    return () => {
      active = false
    }
  }, [url])

  return src
}
