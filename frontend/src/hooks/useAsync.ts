import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../utils/error'

export interface AsyncState<T> {
  data: T | null
  error: string
  loading: boolean
  reload: () => void
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const seqRef = useRef(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const reload = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    const seq = ++seqRef.current
    let active = true
    setLoading(true)
    setError('')
    fnRef
      .current()
      .then((result) => {
        if (active && seq === seqRef.current) setData(result)
      })
      .catch((e) => {
        if (active && seq === seqRef.current) setError(errorMessage(e))
      })
      .finally(() => {
        if (active && seq === seqRef.current) setLoading(false)
      })
    return () => {
      active = false
    }
    // 依赖数组由调用方传入，tick 用于 reload 手动重触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { data, error, loading, reload }
}